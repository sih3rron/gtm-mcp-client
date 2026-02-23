#!/usr/bin/env node

/**
 * MCP-to-HTTP Bridge (with Authentication & Progress Notifications)
 * Translates between Claude Desktop's MCP stdio protocol 
 * and your HTTP REST MCP service on AWS Fargate
 * 
 * ADDED: Support for progress notifications to prevent timeouts on long-running operations
 */

class MCPHTTPBridge {
  constructor(httpServiceUrl) {
    this.httpServiceUrl = httpServiceUrl;
    this.initialized = false;
    // Get the API key from environment
    this.apiKey = process.env.SERVICE_API_KEY;
    
    if (!this.apiKey) {
      this.logError('⚠️  WARNING: SERVICE_API_KEY not set in environment');
    } else {
      this.logError('✅ SERVICE_API_KEY loaded from environment');
    }
  }

  /**
   * Get headers with authentication
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MCP-Bridge/1.0.0'
    };
    
    // Add Authorization header if API key is available
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Send progress notification to client
   * This keeps the connection alive during long-running operations
   */
  sendProgress(requestId, progress, total, message) {
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: requestId,
        progress: progress,
        total: total
      }
    };
    
    if (message) {
      notification.params.message = message;
    }
    
    this.logError(`📊 Sending progress: ${progress}/${total} - ${message || 'Processing...'}`);
    this.sendResponse(notification);
  }

  async fetchTools() {
    try {
      this.logError('Attempting to fetch tools from:', `${this.httpServiceUrl}/tools`);
      const response = await fetch(`${this.httpServiceUrl}/tools`, {
        timeout: 10000, // 10 second timeout
        headers: this.getHeaders()
      });
      
      this.logError('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      this.logError('Tools fetched successfully, count:', data.tools?.length || 0);
      return data.tools || [];
    } catch (error) {
      this.logError('Error fetching tools:', error.message);
      return [];
    }
  }

  /**
   * Call a tool with progress tracking
   * For long-running tools, this will send periodic progress notifications
   */
  async callToolWithProgress(requestId, toolName, args) {
    this.logError(`🔧 Calling tool: ${toolName} with progress tracking`);
    
    // Identify long-running tools that need progress notifications
    const longRunningTools = ['analyze_calls_framework', 'get_gong_call_details'];
    const isLongRunning = longRunningTools.includes(toolName);
    
    let progressInterval;
    let progressCounter = 0;
    
    if (isLongRunning) {
      this.logError(`⏱️  ${toolName} identified as long-running, starting progress notifications`);
      
      // Send progress every 10 seconds to keep connection alive
      progressInterval = setInterval(() => {
        progressCounter++;
        const progress = Math.min(progressCounter * 10, 90); // Cap at 90% until complete
        this.sendProgress(
          requestId, 
          progress, 
          100, 
          `Analyzing ${args.callIds?.length || 1} call(s)... (${progressCounter * 10}s elapsed)`
        );
      }, 10000); // Every 10 seconds
      
      // Send initial progress
      this.sendProgress(requestId, 0, 100, `Starting ${toolName}...`);
    }
    
    try {
      const response = await fetch(`${this.httpServiceUrl}/tools/call`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: toolName,
          arguments: args
        }),
        // No timeout here - let it run as long as needed
      });
      
      if (progressInterval) {
        clearInterval(progressInterval);
        // Send completion progress
        this.sendProgress(requestId, 100, 100, 'Analysis complete!');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      this.logError(`✅ Tool ${toolName} completed successfully`);
      return result;
      
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      this.logError(`❌ Tool ${toolName} failed:`, error.message);
      throw error;
    }
  }

  async handleRequest(request) {
    this.logError('Received request:', request.method);
    
    try {
      switch (request.method) {
        
        case 'initialize':
          const requestedVersion = request.params?.protocolVersion || '2025-11-25';
          if (requestedVersion !== '2025-11-25') {
            throw new Error('Unsupported protocol version');
          }
          this.sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: requestedVersion,
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'miro-mcp-http',
                version: '1.0.0'
              }
            }
          });
          this.initialized = true;
          this.logError('Initialization complete');
          break;

        case 'tools/list':
          if (!this.initialized) {
            throw new Error('Server not initialized');
          }
          
          const tools = await this.fetchTools();
          this.sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: tools
            }
          });
          break;

        case 'tools/call':
          if (!this.initialized) {
            throw new Error('Server not initialized');
          }
          
          const { name, arguments: args } = request.params;
          
          // Use progress-aware tool calling
          const result = await this.callToolWithProgress(request.id, name, args);
          
          this.sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            }
          });
          break;

        case 'ping':
          this.sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {}
          });
          break;

        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    } catch (error) {
      this.logError('Error handling request:', error.message);
      this.sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error.message
        }
      });
    }
  }

  sendResponse(response) {
    const responseStr = JSON.stringify(response);
    console.log(responseStr); // Send to stdout for Claude Desktop
  }

  logError(...args) {
    console.error(new Date().toISOString(), ...args);
  }

  start() {
    this.logError('Starting MCP HTTP Bridge with progress notifications');
    this.logError('Service URL:', this.httpServiceUrl);
    this.logError('API Key configured:', !!this.apiKey);
    
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const request = JSON.parse(trimmed);
            
            // Validate basic JSON-RPC structure
            if (!request.jsonrpc || !request.method || request.id === undefined) {
              this.logError('Invalid JSON-RPC request:', trimmed);
              continue;
            }
            
            this.handleRequest(request);
          } catch (error) {
            this.logError('JSON parse error:', error.message);
            this.logError('Failed to parse:', trimmed);
          }
        }
      }
    });

    process.stdin.on('end', () => {
      this.logError('stdin closed, exiting');
      setTimeout(() => process.exit(0), 100);
    });

    process.stdin.on('error', (error) => {
      this.logError('stdin error:', error.message);
      setTimeout(() => process.exit(1), 100);
    });

    // Handle process signals gracefully
    process.on('SIGINT', () => {
      this.logError('Received SIGINT, exiting gracefully');
      setTimeout(() => process.exit(0), 100);
    });

    process.on('SIGTERM', () => {
      this.logError('Received SIGTERM, exiting gracefully');
      setTimeout(() => process.exit(0), 100);
    });

    // Keep alive heartbeat
    setInterval(() => {
      // Just stay alive
    }, 30000);
  }
}

// Get the HTTP service URL from command line arguments or environment
const HTTP_SERVICE_URL = process.argv[2] || process.env.MIRO_MCP_SERVICE_URL;

if (!HTTP_SERVICE_URL) {
  console.error('Usage: node mcp-http-bridge.js <http-service-url>');
  console.error('Or set MIRO_MCP_SERVICE_URL environment variable');
  process.exit(1);
}

// Validate URL format
try {
  new URL(HTTP_SERVICE_URL);
} catch (error) {
  console.error('Invalid URL format:', HTTP_SERVICE_URL);
  process.exit(1);
}

// Start the bridge
const bridge = new MCPHTTPBridge(HTTP_SERVICE_URL);
bridge.start();