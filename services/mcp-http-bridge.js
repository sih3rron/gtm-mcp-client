#!/usr/bin/env node

/**
 * MCP-to-HTTP Bridge (with Authentication)
 * Translates between Claude Desktop's MCP stdio protocol 
 * and your HTTP REST MCP service on AWS Fargate
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
      this.logError('Full error:', error);
      return [];
    }
  }

  async callTool(name, arguments_) {
    try {
      const response = await fetch(`${this.httpServiceUrl}/tools/call`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ 
          name, 
          arguments: arguments_ 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.logError(`Error calling tool ${name}:`, error.message);
      throw error;
    }
  }

  sendResponse(id, result, error = null) {
    const response = {
      jsonrpc: "2.0",
      id,
    };

    if (error) {
      response.error = {
        code: error.code || -32603,
        message: error.message || 'Internal error',
        ...(error.data && { data: error.data })
      };
    } else {
      response.result = result;
    }

    process.stdout.write(JSON.stringify(response) + '\n');
  }

  logError(message, details = '') {
    process.stderr.write(`[MCP Bridge] ${message} ${details}\n`);
  }

  async handleRequest(request) {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize': {
          const clientInfo = params?.clientInfo || {};
          
          const result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "miro-template-recommender-bridge",
              version: "1.0.0"
            }
          };
          
          this.sendResponse(id, result);
          this.initialized = true;
          break;
        }

        case 'tools/list': {
          if (!this.initialized) {
            this.sendResponse(id, null, {
              code: -32002,
              message: 'Server not initialized'
            });
            return;
          }

          const tools = await this.fetchTools();
          this.sendResponse(id, { tools });
          break;
        }

        case 'tools/call': {
          if (!this.initialized) {
            this.sendResponse(id, null, {
              code: -32002,
              message: 'Server not initialized'
            });
            return;
          }

          const { name, arguments: args } = params || {};
          
          if (!name) {
            this.sendResponse(id, null, {
              code: -32602,
              message: 'Missing required parameter: name'
            });
            return;
          }

          try {
            const result = await this.callTool(name, args || {});
            
            // Ensure the result has the correct MCP format
            const mcpResult = {
              content: Array.isArray(result.content) ? result.content : [
                {
                  type: "text",
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ],
              isError: false
            };
            
            this.sendResponse(id, mcpResult);
          } catch (error) {
            const mcpError = {
              content: [{
                type: "text",
                text: `Error: ${error.message}`
              }],
              isError: true
            };
            
            this.sendResponse(id, mcpError);
          }
          break;
        }

        case 'ping': {
          this.sendResponse(id, {});
          break;
        }

        default:
          this.sendResponse(id, null, {
            code: -32601,
            message: `Method not found: ${method}`
          });
      }
    } catch (error) {
      this.logError('Request handling error:', error.message);
      this.sendResponse(id, null, {
        code: -32603,
        message: 'Internal error',
        data: error.message
      });
    }
  }

  start() {
    this.logError('Starting MCP-HTTP Bridge, connecting to:', this.httpServiceUrl);

    // Keep process alive
    process.stdin.resume();
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
      setTimeout(() => process.exit(0), 100); // Small delay
    });

    process.stdin.on('error', (error) => {
      this.logError('stdin error:', error.message);
      setTimeout(() => process.exit(1), 100); // Small delay
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
      // Just stay alive, don't output anything
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