#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { MiroClient } from './miro-client';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk'
import { FrameworkAnalyzer, safeFrameworkAnalysis, FrameworkResources } from './framework-analyzer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ResourceManager } from './resource-manager';
import { validateApiKey } from './middleware/auth.middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

interface TemplateCategory {
    keywords: string[];
    semanticDescription: string;
    templates: {
        name: string;
        url: string;
        description: string;
    }[];
}

interface TemplateCategories {
    [categoryName: string]: TemplateCategory;
}

// Gong API Configuration
const GONG_API_BASE = 'https://us-45594.api.gong.io/v2';

class MiroHTTPService {
    private app: express.Application;
    private miroClient?: MiroClient;
    private gongAuth?: string;
    private anthropicClient?: AnthropicBedrock;
    private frameworkAnalyzer?: FrameworkAnalyzer;
    private frameworksPath: string;
    private resourceManager?: ResourceManager;
    private resourceCache: Map<string, FrameworkResources> = new Map();
    private templateCategories: Record<string, any> = {};


    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.app.use(validateApiKey);
        this.setupRoutes();
        this.frameworksPath = path.join(__dirname, 'frameworks');
        this.resourceManager = new ResourceManager();

        // Debug environment variables
        console.log("Environment variables check:");
        console.log("MIRO_ACCESS_TOKEN exists:", !!process.env.MIRO_ACCESS_TOKEN);
        console.log("MIRO_ACCESS_TOKEN length:", process.env.MIRO_ACCESS_TOKEN?.length || 0);
        console.log("All env vars starting with MIRO:", Object.keys(process.env).filter(key => key.startsWith('MIRO')));
        console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
        console.log("AWS_SECRET_ACCESS_KEY exists:", !!process.env.AWS_SECRET_ACCESS_KEY);
        console.log("AWS_REGION:", process.env.AWS_REGION || 'us-east-1');
        console.log("ANTHROPIC_MODEL:", process.env.ANTHROPIC_MODEL);

        // Initialize MiroClient if access token is available
        const accessToken = process.env.MIRO_ACCESS_TOKEN;
        if (accessToken) {
            this.miroClient = new MiroClient(accessToken);
            console.log("Miro API integration enabled");
        } else {
            console.log("No Miro access token found, using mock data");
        }


        // Initialize Anthropic client based on environment
        if (process.env.NODE_ENV === 'development') {
            // Development: Use explicit AWS credentials
            const anthropicKey = process.env.ANTHROPIC_API_KEY;
            if (anthropicKey) {
                this.anthropicClient = new AnthropicBedrock({
                    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
                    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
                    awsRegion: process.env.AWS_REGION || 'us-east-1'
                });
                console.log("✅ Anthropic API integration enabled (local dev)");
            } else {
                console.log("⚠️ No ANTHROPIC_API_KEY found for development mode");
            }
        } else {
            // Production: Use environment-based authentication (IAM roles, etc.)
            this.anthropicClient = new AnthropicBedrock({
                awsRegion: process.env.AWS_REGION || 'us-east-1'
            });
            console.log("Anthropic Bedrock integration enabled (production)");
        }

        // Initialize framework analyzer if client is available
        if (this.anthropicClient) {
            this.frameworkAnalyzer = new FrameworkAnalyzer(
                this.anthropicClient, 
                this,  // gongService reference
                this.frameworksPath  // NEW: Pass frameworks path for resource loading
            );
            console.log("✅ Framework Analyzer initialized");
        } else {
            console.log("❌ No Anthropic client available - framework analysis disabled");
        }

        // Load framework definitions
        this.frameworksPath = path.join(__dirname, 'frameworks');
    }

    private async loadTemplateCategories(): Promise<TemplateCategories> {
        if (this.templateCategories) {
            return this.templateCategories;
        }
        
        try {
            const categoriesPath = path.join(__dirname, 'resources', 'templates', 'categories.json');
            const categoriesData = await fs.readFile(categoriesPath, 'utf8');
            this.templateCategories = JSON.parse(categoriesData);
            console.log('✅ Loaded template categories from file');
            return this.templateCategories;
        } catch (error) {
            console.error('❌ Failed to load template categories:', error);
            // Always return an object, never undefined
            this.templateCategories = {};
            return this.templateCategories;
        }
    }

    private async scanFrameworkResources(): Promise<MCPResource[]> {
        try {
            console.log('📚 Loading resources from manifest...');
            const resources = await this.resourceManager?.getMCPResources();
            console.log(`✅ Loaded ${resources?.length} resources from manifest`);
            return resources || [];
        } catch (error) {
            console.error('❌ Error loading resources from manifest:', error);
            return [];
        }
    }

    private getMimeType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.yaml': 'text/yaml',
            '.yml': 'text/yaml'
        };
        return mimeTypes[ext] || 'text/plain';
    }

    private getResourceDescription(frameworkName: string, filename: string): string {
        const descriptions: Record<string, string> = {
            'methodology.md': 'Comprehensive methodology guide and practical application instructions',
            'definition.json': 'Structured framework definition with scoring criteria and keywords',
            'scoring_examples.md': 'Real-world scoring examples and evaluation guidelines',
            'call_examples.md': 'Anonymized call excerpts demonstrating framework application',
            'planning_checklist.md': 'Planning and execution checklist for framework application'
        };

        const frameworkDisplay = frameworkName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const baseDescription = descriptions[filename] || `Framework resource: ${filename}`;
        
        return `${frameworkDisplay} Framework - ${baseDescription}`;
    }

    private async debugDirectoryContents(): Promise<any> {
        try {
            const result: any = {};
            
            try {
                await fs.access(this.frameworksPath);
                result.frameworksExists = true;
                
                const dirs = await fs.readdir(this.frameworksPath);
                result.directories = {};
                
                for (const dir of dirs) {
                    const dirPath = path.join(this.frameworksPath, dir);
                    const stat = await fs.stat(dirPath);
                    
                    if (stat.isDirectory()) {
                        const files = await fs.readdir(dirPath);
                        result.directories[dir] = files;
                    }
                }
            } catch (error) {
                result.frameworksExists = false;
                result.error = error instanceof Error ? error.message : String(error);
            }
            
            return result;
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    private setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'miro-mcp-http',
                miro: !!this.miroClient,
                gong: !!this.gongAuth,
                anthropic: !!this.anthropicClient,
                awsRegion: process.env.AWS_REGION
            });
        });

        // List available tools
        this.app.get('/tools', (req, res) => {
            const tools: MCPTool[] = [
                // Miro tools
                {
                    name: "analyze_board_content",
                    description: "Analyze board content with smart summarization, keywords, and categories",
                    inputSchema: {
                        type: "object",
                        properties: {
                            boardId: { type: "string", description: "Miro board ID" },
                            maxContent: { type: "number", description: "Max items (default: 15)", default: 15 },
                            includeTemplateRecommendations: { type: "boolean", description: "Include template suggestions", default: false },
                            maxTemplateRecommendations: { type: "number", description: "Max templates if included (default: 5)", default: 5 }
                        },
                        required: ["boardId"]
                    }
                },
                {
                    name: "recommend_templates",
                    description: "Get template suggestions for boards or meeting notes",
                    inputSchema: {
                        type: "object",
                        properties: {
                            boardId: { type: "string", description: "Miro board ID to analyze" },
                            meetingNotes: { type: "string", description: "Meeting notes text to analyze" },
                            maxRecommendations: { type: "number", description: "Max templates (default: 5)", default: 5 }
                        }
                    }
                },
                {
                    name: "create_miro_board",
                    description: "Create new Miro board",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Board name" },
                            description: { type: "string", description: "Board description" }
                        },
                        required: ["name"]
                    }
                },
                // Gong tools
                {
                    name: "search_gong_calls",
                    description: "Search Gong calls by customer name and date range. ALWAYS returns Gong call URLs for each matching call.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            customerName: { type: "string", description: "Customer name to search for (fuzzy match in call title)" },
                            fromDate: { type: "string", description: "Start date (ISO 8601, optional)" },
                            toDate: { type: "string", description: "End date (ISO 8601, optional)" },
                            dateRange: { type: "string", description: "Relative date range (e.g., 'last week', 'last 2 weeks', 'last month', 'yesterday'). Takes precedence over fromDate/toDate if provided." }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "select_gong_call",
                    description: "Select a specific call from search results by selection number or direct call ID. ALWAYS return a Gong call URL for the selected call.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            callId: { type: "string", description: "Direct Gong call ID to select" },
                            selectionNumber: { type: "number", description: "Selection number from search results (1, 2, 3, etc.)" },
                            customerName: { type: "string", description: "Original customer name used in search (required when using selectionNumber)" }
                        }
                    }
                },
                {
                    name: "get_gong_call_details",
                    description: "Fetch highlights and keypoints for a Gong call by callId. ALWAYS return a Gong call URL for the selected call.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            callId: { type: "string", description: "The Gong call ID" }
                        },
                        required: ["callId"]
                    }
                }
            ];

            if (this.frameworkAnalyzer) {
                tools.push({
                    name: "analyze_calls_framework",
                    description: "Analyze Gong calls against Command of Message or Great Demo, or Demo2Win frameworks",
                    inputSchema: {
                        type: "object",
                        properties: {
                            callIds: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of Gong call IDs to analyze"
                            },
                            frameworks: {
                                type: "array",
                                items: {
                                    type: "string",
                                    enum: ["command_of_the_message", "great_demo", "demo2win"]
                                },
                                description: "Frameworks: 'command_of_the_message', 'great_demo', 'demo2win'"
                            },
                            includeParticipantRoles: {
                                type: "boolean",
                                default: true
                            }
                        },
                        required: ["callIds", "frameworks"]
                    }
                });
            }

            res.json({ tools });
        });

        // Call tool endpoint
        this.app.post('/tools/call', async (req, res) => {
            try {
                const { name, arguments: args } = req.body;

                if (!name) {
                    return res.status(400).json({ error: 'Tool name is required' });
                }

                let result;

                switch (name) {
                    // Miro tools
                    case 'analyze_board_content':
                        result = await this.analyzeBoardContent(args);
                        break;
                    case 'recommend_templates':
                        result = await this.recommendTemplates(args);
                        break;
                    case 'create_miro_board':
                        result = await this.createMiroBoard(args);
                        break;

                    // Gong tools
                    case 'search_gong_calls':
                        result = await this.searchGongCalls(args);
                        break;
                    case 'select_gong_call':
                        result = await this.selectGongCall(args);
                        break;
                    case 'get_gong_call_details':
                        result = await this.getGongCallDetails(args);
                        break;
                    case 'analyze_calls_framework':
                        if (!this.frameworkAnalyzer) {
                            return res.status(500).json({
                                error: 'Framework analysis not available. Check Anthropic client configuration.'
                            });
                        }
                        result = await safeFrameworkAnalysis(this.frameworkAnalyzer, args);
                        break;

                    default:
                        return res.status(400).json({ error: `Unknown tool: ${name}` });
                }

                res.json(result);
            } catch (error) {
                console.error('Tool execution error:', error);
                res.status(500).json({
                    error: 'Tool execution failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        this.app.get('/resources/test', async (req, res) => {
            try {
                const resources = await this.scanFrameworkResources();

                res.json({
                    message: 'Framework resources scanned successfully!',
                    frameworksPath: this.frameworksPath,
                    resourceCount: resources.length,
                    resources: resources.map(r => ({
                        uri: r.uri,
                        name: r.name,
                        mimeType: r.mimeType
                    }))
                });
            } catch (error) {
                console.error('Error in resource test:', error);
                res.status(500).json({
                    error: 'Failed to scan framework resources',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        this.app.get('/resources/debug', async (req, res) => {
            try {
                const resources = await this.scanFrameworkResources();
                
                res.json({
                    message: 'MCP Resources Debug Info',
                    frameworksPath: this.frameworksPath,
                    resourceCount: resources.length,
                    resources: resources,
                    directoryContents: await this.debugDirectoryContents()
                });
            } catch (error) {
                console.error('❌ Error in resource debug:', error);
                res.status(500).json({ 
                    error: 'Debug failed',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        this.app.get('/resources', async (req, res) => {
            try {
                console.log('📚 MCP Resources list requested');
                const resources = await this.scanFrameworkResources();
                
                // Log for debugging
                console.log('📋 Returning resources:', resources.map(r => r.uri));
                
                res.json({ resources });
            } catch (error) {
                console.error('❌ Error listing MCP resources:', error);
                res.status(500).json({ 
                    error: 'Failed to list resources',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        this.app.get('/resources/frameworks/:framework/:file', async (req, res) => {
            try {
                const { framework, file } = req.params;
                console.log(`📖 MCP Resource requested: /frameworks/${framework}/${file}`);
                
                const filePath = path.join(this.frameworksPath, framework, file);
                
                // Security check - ensure path is within frameworks directory
                const resolvedPath = path.resolve(filePath);
                const resolvedFrameworksPath = path.resolve(this.frameworksPath);
                
                if (!resolvedPath.startsWith(resolvedFrameworksPath)) {
                    console.warn('🚫 Security: Access denied for path:', resolvedPath);
                    return res.status(403).json({ error: 'Access denied' });
                }

                // Check if file exists
                try {
                    await fs.access(filePath);
                    console.log('✅ File found:', filePath);
                } catch {
                    console.warn('❌ File not found:', filePath);
                    return res.status(404).json({ 
                        error: 'Resource not found',
                        requestedPath: `/frameworks/${framework}/${file}`,
                        actualPath: filePath
                    });
                }

                const content = await fs.readFile(filePath, 'utf8');
                const mimeType = this.getMimeType(file);
                const uri = `/frameworks/${framework}/${file}`;

                console.log(`📄 Returning resource: ${uri} (${content.length} chars, ${mimeType})`);

                // MCP Resource Response Format
                res.json({
                    contents: [{
                        uri,
                        mimeType,
                        text: content
                    }]
                });
            } catch (error) {
                console.error('❌ Error getting MCP resource:', error);
                res.status(500).json({ 
                    error: 'Failed to get resource',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        this.app.get('/frameworks/:framework', async (req, res) => {
            try {
                const { framework } = req.params;
                const frameworkPath = path.join(this.frameworksPath, framework);

                // Check if framework directory exists
                try {
                    const stat = await fs.stat(frameworkPath);
                    if (!stat.isDirectory()) {
                        return res.status(404).json({ error: 'Framework not found' });
                    }
                } catch {
                    return res.status(404).json({ error: 'Framework not found' });
                }

                const files = await fs.readdir(frameworkPath);
                const frameworkResources = [];

                for (const file of files) {
                    const filePath = path.join(frameworkPath, file);
                    try {
                        const fileStats = await fs.stat(filePath);

                        if (fileStats.isFile() && !file.startsWith('.')) {
                            const content = await fs.readFile(filePath, 'utf8');
                            const mimeType = this.getMimeType(file);
                            const uri = `/frameworks/${framework}/${file}`;

                            frameworkResources.push({
                                uri,
                                mimeType,
                                text: content,
                                name: this.getResourceDescription(framework, file),
                                description: this.getResourceDescription(framework, file),
                                filename: file
                            });
                        }
                    } catch (error) {
                        console.warn(`Warning: Could not read file ${file}:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                }

                res.json({
                    framework: framework.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    resourceCount: frameworkResources.length,
                    resources: frameworkResources
                });
            } catch (error) {
                console.error('Error getting framework resources:', error);
                res.status(500).json({ error: 'Failed to get framework resources' });
            }
        });
    }

    // === GONG IMPLEMENTATIONS ===

    private async gongGet(endpoint: string, params: any = {}) {
        const fetchWithRetry = async (fetchFn: () => Promise<any>): Promise<any> => {
            const maxRetries = 3;
            let attempt = 0;
            while (attempt <= maxRetries) {
                try {
                    return await fetchFn();
                } catch (error: any) {
                    if (axios.isAxiosError(error) && error.response?.status === 429) {
                        const retryAfter = error.response.headers['retry-after'];
                        let wait = retryAfter
                            ? parseFloat(retryAfter) * 1000
                            : Math.min((2 ** attempt + Math.random()) * 3000, 60000);
                        if (attempt === maxRetries) {
                            throw error;
                        }
                        await new Promise(res => setTimeout(res, wait));
                        attempt++;
                    } else {
                        throw error;
                    }
                }
            }
        };

        if (endpoint === '/calls') {
            let allCalls: any[] = [];
            let cursor: string | null = null;
            let pageCount = 0;
            const maxPages = 50;

            do {
                const query = { ...params };
                if (cursor) {
                    query.cursor = cursor;
                }
                const url = `${GONG_API_BASE}${endpoint}`;
                const response = await fetchWithRetry(async () => {
                    return axios.get(url, {
                        headers: {
                            'Authorization': `Basic ${this.gongAuth}`,
                            'Content-Type': 'application/json',
                        },
                        params: query,
                    }).then(r => r.data);
                });

                let pageCalls: any[] = [];
                if (Array.isArray(response.calls)) {
                    pageCalls = response.calls;
                } else if (Array.isArray(response.records)) {
                    pageCalls = response.records;
                } else if (response.data && Array.isArray(response.data)) {
                    pageCalls = response.data;
                }

                if (pageCalls.length > 0) {
                    allCalls = allCalls.concat(pageCalls);
                }

                cursor = null;
                if (response.records && response.records.cursor) {
                    cursor = response.records.cursor;
                } else if (response.next) {
                    cursor = response.next;
                } else if (response.cursor) {
                    cursor = response.cursor;
                } else if (response.nextCursor) {
                    cursor = response.nextCursor;
                }

                pageCount++;
                if (pageCount >= maxPages) {
                    break;
                }
                if (cursor) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } while (cursor);

            return { calls: allCalls, next: null };
        }

        const url = `${GONG_API_BASE}${endpoint}`;
        return await fetchWithRetry(async () => {
            return axios.get(url, {
                headers: {
                    'Authorization': `Basic ${this.gongAuth}`,
                    'Content-Type': 'application/json',
                },
                params,
            }).then(r => r.data);
        });
    }

    private async gongPost(endpoint: string, data: any) {
        const url = `${GONG_API_BASE}${endpoint}`;
        return axios.post(url, data, {
            headers: {
                'Authorization': `Basic ${this.gongAuth}`,
                'Content-Type': 'application/json',
            },
        }).then(r => r.data);
    }

    private generateTranscriptSummary(transcript: any[]): {
        totalSpeakers: number;
        totalDuration: number;
        keyTopics: string[];
        speakerSummary: { [speaker: string]: { messageCount: number; totalTime: number } };
        conversationFlow: string[];
    } {
        if (!transcript || transcript.length === 0) {
            return {
                totalSpeakers: 0,
                totalDuration: 0,
                keyTopics: [],
                speakerSummary: {},
                conversationFlow: []
            };
        }

        const speakers = new Set<string>();
        let totalDuration = 0;
        const speakerStats: { [speaker: string]: { messageCount: number; totalTime: number } } = {};
        const conversationFlow: string[] = [];
        const allText = transcript.map(t => t.text).join(' ').toLowerCase();

        // Analyze each transcript entry
        transcript.forEach(entry => {
            if (entry.speaker) {
                speakers.add(entry.speaker);
                
                if (!speakerStats[entry.speaker]) {
                    speakerStats[entry.speaker] = { messageCount: 0, totalTime: 0 };
                }
                
                speakerStats[entry.speaker].messageCount++;
                speakerStats[entry.speaker].totalTime += (entry.endTime || 0) - (entry.startTime || 0);
                
                if (entry.endTime) {
                    totalDuration = Math.max(totalDuration, entry.endTime);
                }
            }
            
            if (entry.text) {
                conversationFlow.push(`${entry.speaker}: ${entry.text.substring(0, 100)}${entry.text.length > 100 ? '...' : ''}`);
            }
        });

        // Extract key topics using simple keyword analysis
        const keyTopics = this.extractKeyTopicsFromTranscript(allText);

        return {
            totalSpeakers: speakers.size,
            totalDuration: Math.round(totalDuration),
            keyTopics,
            speakerSummary: speakerStats,
            conversationFlow: conversationFlow.slice(0, 10) // Limit to first 10 exchanges
        };
    }

    private extractKeyTopicsFromTranscript(text: string): string[] {
        const businessKeywords = [
            'budget', 'cost', 'price', 'investment', 'roi', 'value',
            'timeline', 'deadline', 'schedule', 'implementation',
            'requirements', 'needs', 'pain points', 'challenges',
            'solution', 'features', 'capabilities', 'functionality',
            'decision', 'approval', 'next steps', 'follow up',
            'technical', 'integration', 'deployment', 'setup',
            'team', 'stakeholders', 'decision maker', 'approval process'
        ];

        const foundTopics = businessKeywords.filter(keyword => 
            text.includes(keyword.toLowerCase())
        );

        return [...new Set(foundTopics)].slice(0, 8); // Return top 8 unique topics
    }

    private async getSpeakerInformation(callId: string, metaData: any, extensiveCallData?: any, transcript?: any[]): Promise<any> {
        try {
            // Look for speaker information in the available data
            const speakerInfo: any = {};
            
            // Check if there's speaker information in the call data
            if (metaData.speakers) {
                speakerInfo.metaDataSpeakers = metaData.speakers;
            }
            if (extensiveCallData?.speakers) {
                speakerInfo.extensiveSpeakers = extensiveCallData.speakers;
            }
            if (metaData.speakerMapping) {
                speakerInfo.speakerMapping = metaData.speakerMapping;
            }
            if (extensiveCallData?.speakerMapping) {
                speakerInfo.extensiveSpeakerMapping = extensiveCallData.speakerMapping;
            }
            
            // Check if there's speaker information in the content
            if (extensiveCallData?.content?.speakers) {
                speakerInfo.contentSpeakers = extensiveCallData.content.speakers;
            }
            
            // Try to get user details from Gong Users API
            if (this.gongAuth) {
                try {
                    // Get unique speaker IDs from the transcript
                    const speakerIds = this.extractUniqueSpeakerIds(transcript || []);
                    console.log(`🔍 Found unique speaker IDs:`, speakerIds);
                    
                    if (speakerIds.length > 0) {
                        // Fetch user details for each speaker ID
                        const userDetails = await this.getUsersByIds(speakerIds);
                        speakerInfo.userDetails = userDetails;
                        console.log(`🔍 Retrieved user details for ${Object.keys(userDetails).length} speakers`);
                        
                        // If we didn't get all speaker details, try fetching all users as fallback
                        const missingSpeakers = speakerIds.filter(id => !userDetails[id]);
                        if (missingSpeakers.length > 0) {
                            console.log(`🔍 ${missingSpeakers.length} speakers not found, trying to fetch all users as fallback...`);
                            const allUsers = await this.getAllUsers();
                            // Add any missing speakers from the all users data
                            missingSpeakers.forEach(speakerId => {
                                if (allUsers[speakerId]) {
                                    userDetails[speakerId] = allUsers[speakerId];
                                }
                            });
                            speakerInfo.userDetails = userDetails;
                            console.log(`🔍 Final user details count: ${Object.keys(userDetails).length}`);
                        }
                    }
                } catch (error) {
                    console.log(`🔍 Failed to get user details from Gong API:`, error);
                }
            }
            
            return speakerInfo;
        } catch (error) {
            console.warn('Failed to get speaker information:', error);
            return {};
        }
    }

    private extractUniqueSpeakerIds(transcript: any[]): string[] {
        const speakerIds = new Set<string>();
        transcript.forEach(entry => {
            if (entry.speakerId) {
                speakerIds.add(entry.speakerId);
            }
        });
        return Array.from(speakerIds);
    }

    private async getUsersByIds(speakerIds: string[]): Promise<{ [key: string]: any }> {
        const userDetails: { [key: string]: any } = {};
        
        console.log(`🔍 Attempting to fetch user details for ${speakerIds.length} speaker IDs:`, speakerIds);
        
        // Fetch user details for each speaker ID
        const userPromises = speakerIds.map(async (speakerId) => {
            try {
                console.log(`🔍 Fetching user details for speaker ID: ${speakerId}`);
                const userData = await this.gongGet(`/users/${speakerId}`);
                console.log(`🔍 Raw user data for ${speakerId}:`, userData);
                
                if (userData && userData.id) {
                    userDetails[speakerId] = userData;
                    console.log(`🔍 Successfully retrieved user details for ${speakerId}:`, {
                        id: userData.id,
                        name: userData.name || userData.displayName,
                        title: userData.title || userData.jobTitle,
                        email: userData.email,
                        fullName: userData.fullName
                    });
                } else {
                    console.warn(`🔍 User data for ${speakerId} missing ID field:`, userData);
                }
            } catch (error) {
                console.log(`🔍 Failed to get user details for speaker ID ${speakerId}:`, error);
                if (error instanceof Error && 'response' in error) {
                    const axiosError = error as any;
                    console.log(`🔍 API Error details for ${speakerId}:`, {
                        status: axiosError.response?.status,
                        statusText: axiosError.response?.statusText,
                        data: axiosError.response?.data
                    });
                }
                // Continue with other speaker IDs even if one fails
            }
        });
        
        await Promise.all(userPromises);
        console.log(`🔍 Final user details retrieved: ${Object.keys(userDetails).length} out of ${speakerIds.length} speakers`);
        return userDetails;
    }

    private async getAllUsers(): Promise<{ [key: string]: any }> {
        try {
            console.log(`🔍 Fetching all users from Gong API...`);
            const allUsers: { [key: string]: any } = {};
            let cursor: string | null = null;
            let pageCount = 0;
            
            do {
                pageCount++;
                const params: any = { limit: 100 };
                if (cursor) {
                    params.cursor = cursor;
                }
                
                console.log(`🔍 Fetching users page ${pageCount} with cursor: ${cursor}`);
                const response = await this.gongGet('/users', params);
                console.log(`🔍 Users API response structure:`, {
                    hasUsers: !!response.users,
                    usersLength: response.users?.length || 0,
                    hasCursor: !!response.cursor,
                    cursor: response.cursor,
                    responseKeys: Object.keys(response)
                });
                
                if (response.users && Array.isArray(response.users)) {
                    response.users.forEach((user: any, index: number) => {
                        if (user.id) {
                            allUsers[user.id] = user;
                            if (index < 3) { // Log first few users for debugging
                                console.log(`🔍 User ${index + 1}:`, {
                                    id: user.id,
                                    name: user.name || user.displayName,
                                    title: user.title || user.jobTitle,
                                    email: user.email
                                });
                            }
                        }
                    });
                } else {
                    console.warn(`🔍 No users array in response:`, response);
                }
                
                cursor = response.cursor || null;
                console.log(`🔍 Fetched ${response.users?.length || 0} users, cursor: ${cursor}`);
                
            } while (cursor && pageCount < 10); // Safety limit to prevent infinite loops
            
            console.log(`🔍 Total users fetched: ${Object.keys(allUsers).length} across ${pageCount} pages`);
            return allUsers;
        } catch (error) {
            console.warn('Failed to fetch all users from Gong API:', error);
            if (error instanceof Error && 'response' in error) {
                const axiosError = error as any;
                console.log(`🔍 Users API Error details:`, {
                    status: axiosError.response?.status,
                    statusText: axiosError.response?.statusText,
                    data: axiosError.response?.data
                });
            }
            return {};
        }
    }

    private async mapSpeakerIdsToNames(transcript: any[], callId: string, participants?: string[], speakerInfo?: any): Promise<any[]> {
        try {
            console.log(`🔍 Mapping speaker IDs to names for call ${callId}`);
            console.log(`🔍 Available participants:`, participants);
            console.log(`🔍 Speaker information:`, speakerInfo);
            console.log(`🔍 Sample transcript entry:`, transcript[0] || null);

            // Create a mapping based on available participants and speaker information
            const speakerMap: { [key: string]: string } = {};
            
            // First, try to use any direct speaker mapping from the API
            if (speakerInfo?.speakerMapping) {
                Object.assign(speakerMap, speakerInfo.speakerMapping);
            }
            if (speakerInfo?.extensiveSpeakerMapping) {
                Object.assign(speakerMap, speakerInfo.extensiveSpeakerMapping);
            }
            if (speakerInfo?.apiSpeakers) {
                // Process API speaker data if available
                if (Array.isArray(speakerInfo.apiSpeakers)) {
                    speakerInfo.apiSpeakers.forEach((speaker: any) => {
                        if (speaker.id && speaker.name) {
                            speakerMap[speaker.id] = speaker.name;
                        }
                    });
                }
            }
            
            // Use user details from Gong Users API (highest priority)
            if (speakerInfo?.userDetails) {
                console.log(`🔍 Processing user details for ${Object.keys(speakerInfo.userDetails).length} speakers`);
                Object.entries(speakerInfo.userDetails).forEach(([speakerId, userData]: [string, any]) => {
                    console.log(`🔍 Processing user data for speaker ID ${speakerId}:`, userData);
                    if (userData && userData.id) {
                        // Create a formatted name with title if available
                        let displayName = userData.name || userData.displayName || userData.fullName;
                        if (userData.title || userData.jobTitle) {
                            const title = userData.title || userData.jobTitle;
                            displayName = `${displayName} (${title})`;
                        }
                        speakerMap[speakerId] = displayName;
                        console.log(`🔍 Mapped speaker ID ${speakerId} to user: ${displayName}`);
                    } else {
                        console.warn(`🔍 User data for ${speakerId} missing ID field:`, userData);
                    }
                });
            } else {
                console.log(`🔍 No user details available in speakerInfo:`, speakerInfo);
            }

            // Validate speaker mappings against actual participants
            if (participants && participants.length > 0) {
                console.log(`🔍 Validating speaker mappings against participants:`, participants);
                Object.entries(speakerMap).forEach(([speakerId, mappedName]) => {
                    // Check if the mapped name matches any actual participant
                    const participantMatch = participants.find(participant => 
                        participant.toLowerCase().includes(mappedName.toLowerCase()) ||
                        mappedName.toLowerCase().includes(participant.toLowerCase()) ||
                        this.namesMatch(mappedName, participant)
                    );
                    
                    if (!participantMatch) {
                        console.warn(`⚠️ Speaker ID ${speakerId} mapped to "${mappedName}" but no matching participant found`);
                        // Try to find a better match or use a fallback
                        const fallbackName = this.findBestParticipantMatch(mappedName, participants);
                        if (fallbackName) {
                            speakerMap[speakerId] = fallbackName;
                            console.log(`🔍 Updated mapping: ${speakerId} → ${fallbackName}`);
                        }
                    } else {
                        console.log(`✅ Validated mapping: ${speakerId} → ${mappedName} matches participant: ${participantMatch}`);
                    }
                });
            }
            
            // Fallback to participant-based mapping
            if (participants && participants.length > 0) {
                // Create a more sophisticated mapping
                participants.forEach((participant: string, index: number) => {
                    // Create multiple possible keys for this participant
                    const keys = [
                        `Speaker ${index + 1}`,
                        `speaker_${index + 1}`,
                        `participant_${index + 1}`,
                        participant.toLowerCase().replace(/\s+/g, '_'),
                        participant.split(' ')[0].toLowerCase(), // First name
                        participant.split(' ').pop()?.toLowerCase() // Last name
                    ];
                    
                    keys.forEach(key => {
                        if (key && !speakerMap[key]) { // Don't override existing mappings
                            speakerMap[key] = participant;
                        }
                    });
                });
            }

            // Map the transcript
            return transcript.map((entry, index) => {
                const speakerId = entry.speakerId;
                let speakerName = entry.speaker;
                let mappingStrategy = 'none';
                
                // Try multiple mapping strategies
                if (speakerId) {
                    // Strategy 1: Direct mapping from speaker map (highest priority)
                    if (speakerMap[speakerId]) {
                        speakerName = speakerMap[speakerId];
                        mappingStrategy = 'direct_map';
                    }
                    // Strategy 2: Try partial matches in speaker map
                    else {
                        const partialMatch = Object.keys(speakerMap).find(key => 
                            key.toLowerCase().includes(speakerId.toLowerCase()) ||
                            speakerId.toLowerCase().includes(key.toLowerCase())
                        );
                        if (partialMatch) {
                            speakerName = speakerMap[partialMatch];
                            mappingStrategy = 'partial_match';
                        }
                    }
                    
                    // Strategy 3: Direct mapping if speakerId matches a participant name
                    if (speakerName === entry.speaker && participants && participants.length > 0) {
                        const directMatch = participants.find(p => 
                            p.toLowerCase().includes(speakerId.toLowerCase()) ||
                            speakerId.toLowerCase().includes(p.toLowerCase())
                        );
                        if (directMatch) {
                            speakerName = directMatch;
                            mappingStrategy = 'participant_match';
                        }
                    }
                    
                    // Strategy 4: Try to parse speakerId as a number and use as index
                    if (speakerName === entry.speaker && participants && participants.length > 0 && !isNaN(parseInt(speakerId))) {
                        const speakerIndex = parseInt(speakerId) - 1;
                        if (speakerIndex >= 0 && speakerIndex < participants.length) {
                            speakerName = participants[speakerIndex];
                            mappingStrategy = 'index_match';
                        }
                    }
                    
                    // Strategy 5: Try to extract a name from the speakerId if it looks like an email or name
                    if (speakerName === entry.speaker && speakerId.includes('@')) {
                        const emailName = speakerId.split('@')[0];
                        speakerName = emailName.replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                        mappingStrategy = 'email_extraction';
                    }
                    
                    // Strategy 6: Use a more readable format for the speaker ID
                    if (speakerName === entry.speaker) {
                        const shortId = speakerId.length > 10 ? speakerId.substring(0, 8) + '...' : speakerId;
                        speakerName = `Speaker (${shortId})`;
                        mappingStrategy = 'fallback_format';
                    }
                } else {
                    // No speaker ID available
                    speakerName = 'Unknown Speaker';
                    mappingStrategy = 'no_speaker_id';
                }

                // Debug logging for first few entries
                if (index < 3) {
                    console.log(`🔍 Mapping entry ${index}:`, {
                        originalSpeaker: entry.speaker,
                        speakerId: speakerId,
                        mappedSpeaker: speakerName,
                        strategy: mappingStrategy,
                        speakerMapKeys: Object.keys(speakerMap).slice(0, 5),
                        participants: participants?.slice(0, 3)
                    });
                }

                return {
                    ...entry,
                    speaker: speakerName,
                    originalSpeakerId: speakerId
                };
            });
        } catch (error) {
            console.warn('Failed to map speaker IDs to names:', error);
            // Return transcript with original speaker IDs if mapping fails
            return transcript.map(entry => ({
                ...entry,
                speaker: entry.speaker || `Speaker (${entry.speakerId?.substring(0, 8) || 'Unknown'})`,
                originalSpeakerId: entry.speakerId
            }));
        }
    }

    private namesMatch(name1: string, name2: string): boolean {
        // Extract first and last names for comparison
        const extractNames = (name: string) => {
            const parts = name.toLowerCase().split(/\s+/);
            return {
                first: parts[0] || '',
                last: parts[parts.length - 1] || '',
                full: parts.join(' ')
            };
        };
        
        const names1 = extractNames(name1);
        const names2 = extractNames(name2);
        
        // Check various matching patterns
        return (
            // Exact match
            names1.full === names2.full ||
            // First name match
            names1.first === names2.first ||
            // Last name match
            names1.last === names2.last ||
            // One name contains the other
            names1.full.includes(names2.full) ||
            names2.full.includes(names1.full) ||
            // First name + last name combination
            (!!names1.first && !!names2.first && names1.first === names2.first) ||
            (!!names1.last && !!names2.last && names1.last === names2.last)
        );
    }

    private findBestParticipantMatch(mappedName: string, participants: string[]): string | null {
        // Try to find the best match using fuzzy matching
        const mappedLower = mappedName.toLowerCase();
        
        // First, try exact matches
        let bestMatch = participants.find(p => p.toLowerCase() === mappedLower);
        if (bestMatch) return bestMatch;
        
        // Try partial matches
        bestMatch = participants.find(p => 
            p.toLowerCase().includes(mappedLower) || 
            mappedLower.includes(p.toLowerCase())
        );
        if (bestMatch) return bestMatch;
        
        // Try first name matches
        const mappedFirst = mappedName.split(/\s+/)[0]?.toLowerCase();
        if (mappedFirst) {
            bestMatch = participants.find(p => 
                p.toLowerCase().split(/\s+/)[0] === mappedFirst
            );
            if (bestMatch) return bestMatch;
        }
        
        // If no good match found, return null (will use fallback)
        return null;
    }

    private flexibleMatch(callTitle: string, searchTerm: string): boolean {
        const title = callTitle.toLowerCase().trim();
        const term = searchTerm.toLowerCase().trim();

        const normalizeText = (text: string) =>
            text.replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const normalizedTitle = normalizeText(title);
        const normalizedTerm = normalizeText(term);

        if (normalizedTitle.includes(normalizedTerm)) {
            return true;
        }

        const titleWords = normalizedTitle.split(' ').filter(w => w.length > 1);
        const termWords = normalizedTerm.split(' ').filter(w => w.length > 1);

        const allWordsFound = termWords.every(searchWord =>
            titleWords.some(titleWord =>
                titleWord.includes(searchWord) ||
                searchWord.includes(titleWord) ||
                this.calculateSimilarity(titleWord, searchWord) > 0.8
            )
        );

        if (allWordsFound && termWords.length > 0) {
            return true;
        }

        for (const searchWord of termWords) {
            if (searchWord.length >= 3) {
                for (const titleWord of titleWords) {
                    if (titleWord.length >= 3) {
                        const sim = this.calculateSimilarity(titleWord, searchWord);
                        if (sim > 0.7) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    private calculateSimilarity(a: string, b: string): number {
        const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
        }
        const dist = matrix[a.length][b.length];
        const maxLen = Math.max(a.length, b.length);
        return maxLen === 0 ? 1 : 1 - dist / maxLen;
    }

    private calculateMatchScore(title: string, searchTerm: string): number {
        const normalizedTitle = title.toLowerCase();
        const normalizedTerm = searchTerm.toLowerCase();
        if (normalizedTitle.includes(normalizedTerm)) return 90;

        const titleWords = normalizedTitle.split(/\s+/);
        const termWords = normalizedTerm.split(/\s+/);
        let score = 0;
        let matchedWords = 0;

        for (const termWord of termWords) {
            for (const titleWord of titleWords) {
                if (titleWord.includes(termWord) || termWord.includes(titleWord)) {
                    matchedWords++;
                    score += 20;
                    break;
                }
            }
        }

        const matchPercentage = matchedWords / termWords.length;
        score += matchPercentage * 30;
        return Math.min(Math.round(score), 85);
    }

    private formatDuration(seconds: number): string {
        if (!seconds) return "Unknown";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    private extractParticipants(metaData: any, call: any, extensiveCallData?: any): string[] {
        // Try multiple locations for participants data
        let participantsData = null;

        // Debug: Log all available data to understand the structure
        console.log(`🔍 Full call object keys:`, Object.keys(call));
        console.log(`🔍 Full metaData object keys:`, Object.keys(metaData));
        if (extensiveCallData) {
            console.log(`🔍 Full extensiveCallData object keys:`, Object.keys(extensiveCallData));
        }
        console.log(`🔍 Searching for participants in:`, {
            'metaData.parties': metaData.parties,
            'metaData.participants': metaData.participants,
            'call.parties': call.parties,
            'call.participants': call.participants,
            'extensiveCallData.parties': extensiveCallData?.parties,
            'extensiveCallData.metaData.parties': extensiveCallData?.metaData?.parties,
            'metaData.primaryUserId': metaData.primaryUserId
        });

        // Check extensive call data first (most likely to have parties data)
        if (extensiveCallData?.metaData?.parties && Array.isArray(extensiveCallData.metaData.parties) && extensiveCallData.metaData.parties.length > 0) {
            participantsData = extensiveCallData.metaData.parties;
            console.log(`🔍 Found participants in extensiveCallData.metaData.parties:`, participantsData);
        } else if (extensiveCallData?.parties && Array.isArray(extensiveCallData.parties) && extensiveCallData.parties.length > 0) {
            participantsData = extensiveCallData.parties;
            console.log(`🔍 Found participants in extensiveCallData.parties:`, participantsData);
        }
        // Check metaData
        else if (metaData.parties && Array.isArray(metaData.parties) && metaData.parties.length > 0) {
            participantsData = metaData.parties;
            console.log(`🔍 Found participants in metaData.parties:`, participantsData);
        } else if (metaData.participants && Array.isArray(metaData.participants) && metaData.participants.length > 0) {
            participantsData = metaData.participants;
            console.log(`🔍 Found participants in metaData.participants:`, participantsData);
        }
        // Check call object
        else if (call.parties && Array.isArray(call.parties) && call.parties.length > 0) {
            participantsData = call.parties;
            console.log(`🔍 Found participants in call.parties:`, participantsData);
        } else if (call.participants && Array.isArray(call.participants) && call.participants.length > 0) {
            participantsData = call.participants;
            console.log(`🔍 Found participants in call.participants:`, participantsData);
        }
        // Search through all properties for any array that might contain participant data
        else {
            console.log(`🔍 No participants found in standard locations, searching all properties...`);
            const allValues = [...Object.values(metaData), ...Object.values(call)];
            for (const value of allValues) {
                if (Array.isArray(value) && value.length > 0) {
                    // Check if this array contains objects that look like participants
                    const firstItem = value[0];
                    if (firstItem && typeof firstItem === 'object' &&
                        (firstItem.name || firstItem.email || firstItem.displayName)) {
                        participantsData = value;
                        console.log(`🔍 Found participants in array property:`, participantsData);
                        break;
                    }
                }
            }
        }

        console.log(`🔍 Final extracted participants data:`, participantsData);

        return this.formatParticipants(participantsData || []);
    }

    private formatParticipants(parties: any[]): string[] {
        if (!Array.isArray(parties) || parties.length === 0) {
            return ["Unknown participants"];
        }

        return parties.map(party => {
            // Handle different party formats from Gong API
            if (typeof party === 'string') {
                // If it's just an email, try to extract a name
                if (party.includes('@')) {
                    const emailParts = party.split('@')[0];
                    // Convert email format to readable name
                    return emailParts.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
                return party;
            } else if (typeof party === 'object' && party !== null) {
                // If it's an object, try to get name, title, and email
                const name = party.name || party.displayName || party.fullName;
                const title = party.title || party.jobTitle || party.role;
                const email = party.email;

                let result = name || email || 'Unknown';

                // Add job title if available
                if (title) {
                    result += ` (${title})`;
                }

                return result;
            }
            return String(party);
        });
    }

    private parseRelativeDateRange(dateRange?: string): { from: Date; to: Date } {
        const now = new Date();
        const today = new Date(now);
        today.setHours(23, 59, 59, 999); // End of today

        if (!dateRange) {
            // Default to 6 months ago
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            sixMonthsAgo.setHours(0, 0, 0, 0);
            return { from: sixMonthsAgo, to: today };
        }

        const range = dateRange.toLowerCase().trim();
        const from = new Date(now);

        // Parse relative date ranges - check longer periods first
        if (range.includes('last') || range.includes('past')) {
            if (range.includes('2 weeks') || range.includes('two weeks')) {
                from.setDate(now.getDate() - 14);
            } else if (range.includes('3 weeks') || range.includes('three weeks')) {
                from.setDate(now.getDate() - 21);
            } else if (range.includes('week') || range.includes('1 week')) {
                from.setDate(now.getDate() - 7);
            } else if (range.includes('2 months') || range.includes('two months')) {
                from.setMonth(now.getMonth() - 2);
            } else if (range.includes('3 months') || range.includes('three months')) {
                from.setMonth(now.getMonth() - 3);
            } else if (range.includes('6 months') || range.includes('six months')) {
                from.setMonth(now.getMonth() - 6);
            } else if (range.includes('month') || range.includes('1 month')) {
                from.setMonth(now.getMonth() - 1);
            } else if (range.includes('year') || range.includes('1 year')) {
                from.setFullYear(now.getFullYear() - 1);
            } else {
                // Default to 2 weeks if pattern not recognized
                from.setDate(now.getDate() - 14);
            }
        } else if (range.includes('this week')) {
            // Start of current week (Monday)
            const dayOfWeek = now.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            from.setDate(now.getDate() - daysToMonday);
        } else if (range.includes('this month')) {
            // Start of current month
            from.setDate(1);
        } else if (range.includes('yesterday')) {
            from.setDate(now.getDate() - 1);
        } else if (range.includes('today')) {
            from.setDate(now.getDate());
        } else {
            // Default to 2 weeks if pattern not recognized
            from.setDate(now.getDate() - 14);
        }

        from.setHours(0, 0, 0, 0);
        return { from, to: today };
    }

    private async searchGongCalls(args: any) {
        const { customerName, fromDate, toDate, dateRange } = args;

        // Parse date range - prioritize explicit dates over relative ranges
        let from: Date, to: Date;

        if (fromDate && toDate) {
            // Use explicit dates if both provided
            from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
        } else if (dateRange) {
            // Use relative date range
            const parsedRange = this.parseRelativeDateRange(dateRange);
            from = parsedRange.from;
            to = parsedRange.to;
        } else if (fromDate) {
            // Only fromDate provided - use today as toDate
            from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            to = new Date();
            to.setHours(23, 59, 59, 999);
        } else if (toDate) {
            // Only toDate provided - use 6 months ago as fromDate
            to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            from = new Date(to);
            from.setMonth(from.getMonth() - 6);
            from.setHours(0, 0, 0, 0);
        } else {
            // No dates provided - use default 6 months
            const parsedRange = this.parseRelativeDateRange();
            from = parsedRange.from;
            to = parsedRange.to;
        }

        // Ensure fromDate is before toDate
        if (from > to) {
            [from, to] = [to, from];
        }

        const fromISO = from.toISOString();
        const toISO = to.toISOString();

        // Debug: Log the calculated date range
        console.log('=== GONG CALL SEARCH DEBUG ===');
        console.log('Request date (now):', new Date().toISOString());
        console.log('Calculated from date:', fromISO);
        console.log('Calculated to date:', toISO);
        console.log('Date range span:', Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)), 'days');
        console.log('================================');

        let calls: any[];

        if (!this.gongAuth) {
            // Mock data with realistic call IDs and URLs
            calls = [
                {
                    id: "1837352819499284928",
                    title: `${customerName} - Q1 Planning Session`,
                    url: "https://app.gong.io/call?id=1837352819499284928",
                    started: "2025-01-23T10:00:00Z",
                    primaryUserId: "user_123",
                    duration: 3600,
                    parties: ["john.doe@company.com", `manager@${customerName.toLowerCase().replace(/\s+/g, '')}.com`]
                },
                {
                    id: "6935962676834230204",
                    title: `${customerName} - Infrastructure Review`,
                    url: "https://app.gong.io/call?id=6935962676834230204",
                    started: "2025-01-15T14:30:00Z",
                    primaryUserId: "user_456",
                    duration: 2700,
                    parties: ["jane.smith@company.com", `tech@${customerName.toLowerCase().replace(/\s+/g, '')}.com`]
                }
            ];
        } else {
            const data = await this.gongGet('/calls', {
                fromDateTime: fromISO,
                toDateTime: toISO,
                limit: 100
            });

            // Debug: Log raw Gong API response
            console.log(`🔍 Raw Gong search response:`, JSON.stringify({
                hasCalls: !!data.calls,
                callsLength: data.calls?.length || 0,
                firstCall: data.calls?.[0] ? {
                    id: data.calls[0].id,
                    title: data.calls[0].title,
                    parties: data.calls[0].parties,
                    partiesType: typeof data.calls[0].parties,
                    partiesLength: data.calls[0].parties?.length
                } : null
            }, null, 2));

            calls = (data?.calls || []).map((c: any) => ({
                id: c.id,
                title: c.title,
                url: c.url || `https://app.gong.io/call?id=${c.id}`, // Fallback URL
                started: c.started,
                primaryUserId: c.primaryUserId,
                duration: c.duration,
                parties: c.parties || []
            }));
        }

        const wordRegex = new RegExp(`\\b${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        let matches = calls.filter(call => wordRegex.test(call.title))
            .map(call => ({ ...call, matchType: 'exact', score: 100 }));

        if (matches.length === 0) {
            const allFuzzyMatches = calls.filter(call => this.flexibleMatch(call.title, customerName))
                .map(call => ({
                    ...call,
                    matchType: 'fuzzy',
                    score: this.calculateMatchScore(call.title, customerName)
                }));

            const lowQualityMatches = allFuzzyMatches.filter(call => call.score < 50);
            matches = allFuzzyMatches.filter(call => call.score >= 50); // Filter out low-quality fuzzy matches

            // Debug: Log filtering information
            if (lowQualityMatches.length > 0) {
                console.log(`=== FUZZY MATCH FILTERING ===`);
                console.log(`Filtered out ${lowQualityMatches.length} low-quality fuzzy matches (score < 50):`);
                lowQualityMatches.forEach(match => {
                    console.log(`  - "${match.title}" (score: ${match.score})`);
                });
                console.log(`Kept ${matches.length} high-quality fuzzy matches (score >= 50)`);
                console.log(`================================`);
            }
        }

        // Sort by score (highest first) and date (most recent first)
        matches.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return new Date(b.started).getTime() - new Date(a.started).getTime();
        });

        const formattedMatches = matches.map((call, index) => {
            // Debug: Log parties data for each call
            console.log(`🔍 Search call ${call.id} parties:`, {
                parties: call.parties,
                partiesType: typeof call.parties,
                partiesLength: call.parties?.length,
                isArray: Array.isArray(call.parties)
            });

            return {
                selectionNumber: index + 1,
                callId: call.id,
                title: call.title,
                date: new Date(call.started).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                duration: this.formatDuration(call.duration),
                participants: this.formatParticipants(call.parties || []),
                matchType: call.matchType,
                score: call.score,
                url: call.url
            };
        });

        return {
            searchQuery: customerName,
            dateRange: { from: fromISO, to: toISO },
            totalCallsInRange: calls.length,
            matchesFound: matches.length,
            matches: formattedMatches,
            userInstructions: matches.length > 1 ?
                "Multiple calls found. Please use 'select_gong_call' with the selection number or call ID to choose a specific call." :
                matches.length === 1 ?
                    "One call found. You can proceed with this call or use 'select_gong_call' to confirm." :
                    "No matching calls found. Try adjusting the customer name or date range."
        };
    }

    private async selectGongCall(args: any) {
        const { callId, selectionNumber, customerName } = args;

        if (selectionNumber && customerName) {
            const searchResult = await this.searchGongCalls({ customerName });
            const selectedMatch = searchResult.matches.find((match: any) =>
                match.selectionNumber === selectionNumber
            );

            if (!selectedMatch) {
                throw new Error(`Selection number ${selectionNumber} not found. Please use a number between 1 and ${searchResult.matches.length}.`);
            }

            return {
                selectedCall: {
                    callId: selectedMatch.callId,
                    title: selectedMatch.title,
                    date: selectedMatch.date,
                    duration: selectedMatch.duration,
                    participants: selectedMatch.participants,
                    url: selectedMatch.url
                },
                message: `Selected call: "${selectedMatch.title}" from ${selectedMatch.date}`,
                nextSteps: "You can now use 'get_gong_call_details' with this callId to get highlights and key points."
            };
        }

        if (callId) {
            let callDetails: any;
            if (!this.gongAuth) {
                callDetails = {
                    id: callId,
                    title: "Selected Call",
                    started: new Date().toISOString(),
                    url: `https://app.gong.io/call?id=${callId}`
                };
            } else {
                try {
                    const response = await this.gongGet(`/calls/${callId}`);
                    callDetails = response;
                } catch (error) {
                    throw new Error(`Call with ID ${callId} not found or not accessible.`);
                }
            }

            return {
                selectedCall: {
                    callId: callDetails.id,
                    title: callDetails.title,
                    date: new Date(callDetails.started).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    url: callDetails.url
                },
                message: `Selected call: "${callDetails.title}"`,
                nextSteps: "You can now use 'get_gong_call_details' with this callId to get highlights and key points."
            };
        }

        throw new Error("Please provide either a callId or selectionNumber with customerName.");
    }

    public async getGongCallDetails(args: any) {
        const { callId } = args;

        if (!this.gongAuth) {
            const mockTranscript = [
                {
                    speaker: "John Doe (Sales Manager)",
                    text: "Thank you for taking the time to meet with us today. I understand you're looking to improve your current automation processes.",
                    startTime: 0,
                    endTime: 8
                },
                {
                    speaker: "Jane Smith (Technical Lead)",
                    text: "Yes, exactly. We're currently spending about 3 hours daily on manual data entry tasks that could be automated. It's becoming a real bottleneck for our team.",
                    startTime: 8,
                    endTime: 18
                },
                {
                    speaker: "John Doe (Sales Manager)",
                    text: "That's a significant time investment. What's your current budget allocation for automation solutions?",
                    startTime: 18,
                    endTime: 25
                },
                {
                    speaker: "Jane Smith (Technical Lead)",
                    text: "We have budget approved for Q2 implementation. The decision maker will be joining our next call to discuss the technical requirements in more detail.",
                    startTime: 25,
                    endTime: 35
                }
            ];

            return {
                callId,
                callUrl: `https://app.gong.io/call?id=${callId}`,
                title: `Mock Call ${callId}`,
                date: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                duration: "45m",
                participants: ["John Doe (Sales Manager)", "Jane Smith (Technical Lead)"],
                highlights: [
                    "Customer expressed strong interest in automation features",
                    "Main pain point: Current manual process takes 3 hours daily",
                    "Budget approved for Q2 implementation",
                    "Decision maker will be joining next call"
                ],
                keyPoints: [
                    "Customer is looking to reduce manual work",
                    "Timeline is aggressive - needs solution by Q2",
                    "Budget has been allocated",
                    "Technical team will evaluate next week"
                ],
                brief: "Mock call brief for testing purposes",
                outline: "Mock call outline for testing purposes",
                transcript: mockTranscript,
                hasTranscript: true,
                transcriptSummary: this.generateTranscriptSummary(mockTranscript),
                mock: true
            };
        }

        try {
            // First, get basic call information using the simple GET endpoint
            console.log(`🔍 Fetching basic call info for ID: ${callId}`);
            const basicCallData = await this.gongGet(`/calls/${callId}`);
            console.log(`🔍 Basic call data structure:`, {
                type: typeof basicCallData,
                isArray: Array.isArray(basicCallData),
                hasId: !!basicCallData?.id,
                hasTitle: !!basicCallData?.title,
                keys: basicCallData ? Object.keys(basicCallData) : []
            });

            // Then get detailed content using the extensive endpoint
            const postBody = {
                filter: { callIds: [callId] },
                contentSelector: {
                    context: "Extended",
                    contextTiming: ["TimeOfCall"],
                    exposedFields: {
                        parties: true,
                        actualStart: true,
                        started: true,
                        duration: true,
                        title: true,
                        url: true,
                        content: {
                            structure: false,
                            topics: false,
                            trackers: false,
                            trackerOccurrences: false,
                            pointsOfInterest: false,
                            brief: true,
                            outline: true,
                            highlights: true,
                            callOutcome: false,
                            keyPoints: true
                        }
                    }
                }
            };

            console.log(`🔍 Fetching detailed content for ID: ${callId}`);
            console.log(`🔍 Request body for extensive call:`, JSON.stringify(postBody, null, 2));
            const contentData = await this.gongPost('/calls/extensive', postBody);
            console.log(`🔍 Extensive call response structure:`, {
                hasCalls: !!contentData.calls,
                callsLength: contentData.calls?.length || 0,
                firstCallKeys: contentData.calls?.[0] ? Object.keys(contentData.calls[0]) : 'N/A',
                firstCallContent: contentData.calls?.[0]?.content ? Object.keys(contentData.calls[0].content) : 'N/A'
            });
            // Use basic call data for basic fields, content data for detailed content
            // Handle both single call and multiple calls scenarios
            const call = Array.isArray(basicCallData) ? basicCallData[0] : basicCallData;

            // Check if we got valid call data - be more flexible with validation
            if (!call) {
                throw new Error(`Call with ID ${callId} not found`);
            }

            // Debug: Log the call structure to understand what we're working with
            console.log(`🔍 Call object structure:`, JSON.stringify({
                hasMetaData: !!call.metaData,
                hasId: !!call.id,
                hasTitle: !!call.title,
                keys: Object.keys(call),
                metaDataKeys: call.metaData ? Object.keys(call.metaData) : 'N/A'
            }, null, 2));

            // Find the content for the specific call ID
            let content = {};
            let extensiveCallData = null;
            if (contentData.calls && Array.isArray(contentData.calls)) {
                // Find the call with matching ID
                const matchingCall = contentData.calls.find((c: any) => c.metaData?.id === callId || c.id === callId);
                content = matchingCall?.content || {};
                extensiveCallData = matchingCall;
                console.log(`🔍 Found matching call for ID ${callId}:`, !!matchingCall);
                if (matchingCall) {
                    console.log(`🔍 Matching call ID:`, matchingCall.metaData?.id || matchingCall.id);
                    console.log(`🔍 Matching call parties:`, matchingCall.metaData?.parties || matchingCall.parties);
                }
            } else if (contentData.content) {
                content = contentData.content;
            }

            // Debug: Log content data structure
            console.log(`🔍 Content data calls length:`, contentData.calls?.length || 0);
            console.log(`🔍 Content data structure:`, JSON.stringify({
                hasCalls: !!contentData.calls,
                callsLength: contentData.calls?.length || 0,
                hasContent: !!contentData.content,
                selectedContent: !!content
            }, null, 2));

            // Extract metadata from the call object - handle different structures
            let metaData;
            if (call.metaData) {
                // Data is nested under metaData
                metaData = call.metaData;
            } else if (call.id || call.title) {
                // Data is directly on the call object
                metaData = call;
            } else {
                // Try to find any object with id or title
                const possibleMetaData = Object.values(call).find((value: any) =>
                    value && typeof value === 'object' && (value.id || value.title)
                );
                metaData = possibleMetaData || call;
            }

            console.log(`🔍 Selected metaData:`, JSON.stringify({
                id: metaData.id,
                title: metaData.title,
                started: metaData.started,
                duration: metaData.duration,
                url: metaData.url,
                parties: metaData.parties,
                participants: metaData.participants,
                primaryUserId: metaData.primaryUserId
            }, null, 2));

            
            // Debug: Log the call structure to understand the data format
            console.log('🔍 Gong call response structure:', JSON.stringify({
                callId: metaData.id,
                title: metaData.title,
                actualStart: metaData.actualStart,
                started: metaData.started,
                duration: metaData.duration,
                url: metaData.url,
                parties: metaData.parties,
                partiesType: typeof metaData.parties,
                partiesIsArray: Array.isArray(metaData.parties),
                partiesLength: metaData.parties?.length
            }, null, 2));

            // Calculate date and duration with detailed logging
            const formattedDate = metaData.actualStart ? new Date(metaData.actualStart).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : (metaData.started ? new Date(metaData.started).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : "Unknown");

            const formattedDuration = this.formatDuration(metaData.duration) || "Unknown";

            // Add detailed logging for Duration and CallDate
            console.log('📅 CallDate and Duration Debug:');
            console.log('  - Raw metaData.actualStart:', metaData.actualStart);
            console.log('  - Raw metaData.started:', metaData.started);
            console.log('  - Raw metaData.duration:', metaData.duration);
            console.log('  - Formatted date:', formattedDate);
            console.log('  - Formatted duration:', formattedDuration);

            const result = {
                callId,
                callUrl: metaData.url || `https://app.gong.io/call?id=${callId}`,
                title: metaData.title || `Call ${callId}`,
                date: formattedDate,
                duration: formattedDuration,
                participants: this.extractParticipants(metaData, call, extensiveCallData),
                highlights: (content as any).highlights || ["No highlights available"],
                keyPoints: (content as any).keyPoints || ["No key points available"],
                brief: (content as any).brief || "No brief available",
                outline: (content as any).outline || "No outline available"
            };

            // Debug: Log what we're returning
            console.log('🔍 getGongCallDetails returning:', JSON.stringify({
                callId: result.callId,
                title: result.title,
                date: result.date,
                duration: result.duration,
                participants: result.participants
            }, null, 2));

            return result;

        } catch (error) {
            console.error('Error getting Gong call details:', error);

            if (error instanceof Error && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Call ID ${callId} not found in Gong. Please verify the call ID exists and you have access to it.`);
                } else if (axiosError.response?.status === 401) {
                    throw new Error(`Gong API authentication failed. Please check your GONG_KEY and GONG_SECRET credentials.`);
                } else if (axiosError.response?.status === 403) {
                    throw new Error(`Access denied to call ${callId}. Please check your Gong API permissions.`);
                }
            }

            throw new Error(`Failed to get call details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async getGongCallTranscript(callId: string): Promise<{
        hasTranscript: boolean;
        transcript?: any[];
        transcriptSummary?: any;
    }> {
        if (!this.gongAuth) {
            // Return mock transcript data for testing
            const mockTranscript = [
                {
                    speaker: "John Doe (Sales Manager)",
                    text: "Thank you for taking the time to meet with us today. I understand you're looking to improve your current automation processes.",
                    startTime: 0,
                    endTime: 8,
                    speakerId: "speaker_1"
                },
                {
                    speaker: "Jane Smith (Technical Lead)",
                    text: "Yes, exactly. We're currently spending about 3 hours daily on manual data entry tasks that could be automated. It's becoming a real bottleneck for our team.",
                    startTime: 8,
                    endTime: 18,
                    speakerId: "speaker_2"
                }
            ];

            return {
                hasTranscript: true,
                transcript: mockTranscript,
                transcriptSummary: this.generateTranscriptSummary(mockTranscript)
            };
        }

        try {
            console.log(`🔍 Fetching transcript for call ID: ${callId}`);
            console.log(`🔍 Gong Auth available: ${!!this.gongAuth}`);
            console.log(`🔍 Using Gong API endpoint: ${GONG_API_BASE}/calls/transcript`);
            
            // Use the Gong API POST endpoint to get transcript data
            // Based on official Gong API documentation: POST /v2/calls/transcript
            const transcriptData = await this.gongPost('/calls/transcript', {
                filter: {
                    callIds: [callId]
                }
            });
            
            console.log(`🔍 Raw transcript response structure:`, {
                hasCallTranscripts: !!transcriptData.callTranscripts,
                callTranscriptsLength: transcriptData.callTranscripts?.length || 0,
                responseKeys: Object.keys(transcriptData),
                responseType: typeof transcriptData,
                isArray: Array.isArray(transcriptData),
                fullResponse: JSON.stringify(transcriptData, null, 2)
            });

            // Extract transcript from the response based on Gong API structure
            let transcript = [];
            console.log(`🔍 Attempting to extract transcript from response...`);
            
            if (transcriptData.callTranscripts && Array.isArray(transcriptData.callTranscripts)) {
                // Find the transcript for our specific callId
                const callTranscript = transcriptData.callTranscripts.find((ct: any) => ct.callId === callId);
                if (callTranscript && callTranscript.transcript && Array.isArray(callTranscript.transcript)) {
                    // Convert Gong transcript format to our expected format
                    transcript = callTranscript.transcript.map((monologue: any) => {
                        // Convert monologue to individual sentences
                        const sentences = monologue.sentences || [];
                        return sentences.map((sentence: any) => ({
                            speakerId: monologue.speakerId,
                            speaker: `Speaker ${monologue.speakerId}`, // Will be mapped to names later
                            text: sentence.text || '',
                            startTime: sentence.startTime || 0,
                            endTime: sentence.endTime || 0,
                            topic: monologue.topic || ''
                        }));
                    }).flat(); // Flatten the array of sentence arrays
                    console.log(`✅ Found transcript for callId ${callId} (${transcript.length} entries)`);
                    console.log(`🔍 Sample transcript entry:`, transcript[0] || 'No entries');
                } else {
                    console.log(`❌ No transcript found for callId ${callId} in callTranscripts`);
                    console.log(`🔍 Available callTranscripts:`, transcriptData.callTranscripts?.map((ct: any) => ({
                        callId: ct.callId,
                        hasTranscript: !!ct.transcript,
                        transcriptLength: ct.transcript?.length || 0
                    })) || 'None');
                }
            } else {
                console.log(`❌ No callTranscripts found in response. Available keys:`, Object.keys(transcriptData));
                console.log(`❌ Response structure:`, JSON.stringify(transcriptData, null, 2));
            }

            // Map speaker IDs to names if we have participant data
            let processedTranscript = transcript;
            if (transcript.length > 0) {
                try {
                    // Get call details to extract participants for speaker mapping
                    const callDetails = await this.getGongCallDetails({ callId });
                    const participants = callDetails.participants || [];
                    
                    // Get speaker information for better mapping
                    const speakerInfo = await this.getSpeakerInformation(callId, {}, {}, transcript);
                    
                    // Map speaker IDs to names
                    processedTranscript = await this.mapSpeakerIdsToNames(
                        transcript, 
                        callId, 
                        participants, 
                        speakerInfo
                    );
                    
                    console.log(`✅ Successfully processed transcript with ${processedTranscript.length} entries`);
                } catch (mappingError) {
                    console.warn(`⚠️ Failed to map speaker names, using raw transcript:`, mappingError);
                    // Use raw transcript if mapping fails
                    processedTranscript = transcript.map((entry: any) => ({
                        ...entry,
                        speaker: entry.speaker || `Speaker (${entry.speakerId?.substring(0, 8) || 'Unknown'})`
                    }));
                }
            }

            const hasTranscript = processedTranscript.length > 0;
            const transcriptSummary = hasTranscript ? this.generateTranscriptSummary(processedTranscript) : null;

            console.log(`✅ Transcript fetch complete:`, {
                callId,
                hasTranscript,
                transcriptLength: processedTranscript.length,
                totalDuration: transcriptSummary?.totalDuration || 0,
                totalSpeakers: transcriptSummary?.totalSpeakers || 0
            });

            return {
                hasTranscript,
                transcript: processedTranscript,
                transcriptSummary
            };

        } catch (error) {
            console.error(`❌ Error fetching transcript for call ${callId}:`, error);
            
            if (error instanceof Error && 'response' in error) {
                const axiosError = error as any;
                console.error(`🔍 Detailed Gong API Error for transcript:`, {
                    status: axiosError.response?.status,
                    statusText: axiosError.response?.statusText,
                    headers: axiosError.response?.headers,
                    data: axiosError.response?.data,
                    requestUrl: axiosError.config?.url,
                    requestMethod: axiosError.config?.method,
                    requestData: axiosError.config?.data
                });
                
                if (axiosError.response?.status === 404) {
                    console.warn(`⚠️ Transcript not found for call ${callId} - this might mean the endpoint is wrong or the call doesn't exist`);
                    return { hasTranscript: false };
                } else if (axiosError.response?.status === 401) {
                    throw new Error(`Gong API authentication failed. Please check your GONG_KEY and GONG_SECRET credentials.`);
                } else if (axiosError.response?.status === 403) {
                    throw new Error(`Access denied to transcript for call ${callId}. Please check your Gong API permissions.`);
                } else if (axiosError.response?.status === 400) {
                    console.warn(`⚠️ Bad request for transcript - check if the endpoint or request format is correct`);
                    return { hasTranscript: false };
                }
            }

            // Return no transcript on error rather than throwing
            console.warn(`⚠️ Returning no transcript due to error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return { hasTranscript: false };
        }
    }

    private async analyzeBoardContent(args: any) {
        const {
            boardId: rawBoardId,
            maxContent = 15,
            includeTemplateRecommendations = false,
            maxTemplateRecommendations = 5
        } = args;

        const boardId = this.extractBoardId(rawBoardId);

        if (!this.miroClient) {
            return {
                content: ["Sprint planning", "User stories", "Retrospective items"],
                keywords: ["sprint", "user", "retrospective"],
                categories: ["agile"],
                context: "Content appears to focus on: Agile/Scrum methodology",
                stats: { total: 25, analyzed: 3 },
                mock: true
            };
        }

        try {
            const result = await this.miroClient.getSmartBoardAnalysis(boardId, {
                maxContent,
                includeTemplateRecommendations,
                maxTemplateRecommendations
            });

            return {
                content: result.contentSummary.keyContent,
                keywords: result.analysis.detectedKeywords,
                categories: result.analysis.identifiedCategories,
                context: result.analysis.context,
                stats: result.contentSummary.contentStats,
                source: {
                    type: "miro_board",
                    boardId: boardId,
                    boardUrl: `https://miro.com/app/board/${boardId}`,
                    analyzedAt: new Date().toISOString()
                },
                ...(includeTemplateRecommendations && {
                    templates: result.templateRecommendations?.map(t => ({
                        name: t.name,
                        url: t.url,
                        category: t.category,
                        source: "miro_templates"
                    }))
                })
            };
        } catch (error) {
            throw new Error(`Board analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async recommendTemplates(args: any) {
        const { boardId: rawBoardId, meetingNotes, maxRecommendations = 5 } = args;

        let content: string[];
        let contentType: string;

        // Validate that at least one input is provided
        if (!rawBoardId && !meetingNotes) {
            throw new Error("Please provide either a Miro board ID or meeting notes text.");
        }

        // If both are provided, prioritize boardId
        if (rawBoardId) {
            const boardId = this.extractBoardId(rawBoardId);

            if (!this.miroClient) {
                content = ["Sprint planning", "User stories", "Design system"];
            } else {
                content = await this.miroClient.getBoardContent(boardId);
            }
            contentType = "miro_board";
        } else {
            // Only meetingNotes provided
            content = this.parseMeetingNotes(meetingNotes);
            contentType = "meeting_notes";
        }

        const analysis = await this.analyzeContent(content);
        const recommendations = await this.generateRecommendations(analysis, maxRecommendations);

        return {
            contentType,
            analysis: {
                detectedKeywords: analysis.keywords,
                identifiedCategories: analysis.categories,
                context: analysis.context
            },
            recommendations
        };
    }

    private async createMiroBoard(args: any) {
        const { name, description } = args;

        if (!this.miroClient) {
            return {
                id: "mock-board-id",
                name,
                description: description || "",
                url: `https://miro.com/app/board/mock-board-id`,
                mock: true
            };
        }

        try {
            const result = await this.miroClient.createBoard(name, description);

            // Auto-add simon.h@miro.com as per your requirements
            if (result?.id) {
                try {
                    await this.miroClient.shareBoard(result.id, {
                        emails: ["simon.h@miro.com"],
                        role: "editor"
                    });
                } catch (shareError) {
                    console.warn('Failed to add simon.h@miro.com to board:', shareError);
                }
            }

            return {
                id: result.id,
                name: result.name,
                description: result.description,
                url: result.url || `https://miro.com/app/board/${result.id}`
            };
        } catch (error) {
            throw new Error(`Board creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private extractBoardId(input: string): string {
        if (!input.includes('/') && !input.includes('miro.com')) {
            return input.endsWith('=') ? input : input + '=';
        }

        const urlPatterns = [
            /\/board\/([^\/\?#]+)/,
            /\/app\/board\/([^\/\?#]+)/,
        ];

        for (const pattern of urlPatterns) {
            const match = input.match(pattern);
            if (match) {
                let boardId = decodeURIComponent(match[1]);
                return boardId.endsWith('=') ? boardId : boardId + '=';
            }
        }

        return input.endsWith('=') ? input : input + '=';
    }

    private parseMeetingNotes(meetingNotes: string): string[] {
        const lines = meetingNotes.split('\n').filter(line => line.trim().length > 0);
        const content: string[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length < 3) return;

            const cleanedLine = trimmed
                .replace(/^[-*•]\s*/, '')
                .replace(/^\d+\.\s*/, '')
                .replace(/^#{1,6}\s*/, '')
                .trim();

            if (cleanedLine.length > 0 && cleanedLine.length < 200) {
                content.push(cleanedLine);
            }
        });

        return content.slice(0, 25);
    }

    private async analyzeContent(content: string[]): Promise<{
        keywords: string[];
        categories: string[];
        context: string;
    }> {
        const allText = content.join(" ").toLowerCase();
        const foundKeywords: string[] = [];
        const categoryScores: { [key: string]: number } = {};

        for (const [category, categoryData] of Object.entries(this.templateCategories || {})) { 
            const matchingKeywords = categoryData.keywords.filter((keyword: string) =>
                allText.includes(keyword.toLowerCase())
            );

            if (matchingKeywords.length > 0) {
                foundKeywords.push(...matchingKeywords);
                categoryScores[category] = matchingKeywords.length;
            }
        }

        const sortedCategories = Object.entries(categoryScores)
            .sort(([, a], [, b]) => b - a)
            .map(([category]) => category as string);

        const context = await this.generateContextDescription(sortedCategories);

        return {
            keywords: [...new Set(foundKeywords)],
            categories: sortedCategories,
            context
        };
    }

    private async generateRecommendations(
        analysis: { keywords: string[]; categories: string[]; context: string },
        maxRecommendations: number
    ) {
        const recommendations: any[] = [];

        for (const category of analysis.categories) {
            const templateCategories = await this.loadTemplateCategories();
            const categoryTemplates = templateCategories[category]?.templates || []; 
            recommendations.push(...categoryTemplates.map((template: any) => ({
                ...template,
                category,
                relevanceScore: this.calculateRelevanceScore(analysis.keywords, category)
            })));
        }

        return recommendations
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, maxRecommendations)
            .map(rec => ({
                name: rec.name,
                url: rec.url,
                description: rec.description,
                category: rec.category,
                relevanceScore: rec.relevanceScore
            }));
    }

    private async generateContextDescription(categories: string[]): Promise<string> {
        const contextMap: { [key: string]: string } = {
            "workshops": "Team collaboration and workshops"
        };

        const contexts = categories.slice(0, 3).map(cat => contextMap[cat]).filter(Boolean);
        return contexts.length > 0
            ? `Content appears to focus on: ${contexts.join(", ")}`
            : "General collaborative work";
    }

    private async calculateRelevanceScore(keywords: string[], category: string): Promise<number> {
        const templateCategories = await this.loadTemplateCategories();
        const categoryKeywords: readonly string[] = templateCategories[category]?.keywords || [];       
        const matches = keywords.filter((k) => categoryKeywords.includes(k)).length;
        return matches / categoryKeywords.length;
    }

    public async start(port: number = 3001) {
        // Initialize Miro client
        const miroAccessToken = process.env.MIRO_ACCESS_TOKEN;
        if (miroAccessToken) {
            this.miroClient = new MiroClient(miroAccessToken);
            console.log("✅ Miro API integration enabled");
        } else {
            console.log("⚠️  No Miro access token found, using mock data");
        }

        // Initialize Gong authentication
        const gongKey = process.env.GONG_KEY;
        const gongSecret = process.env.GONG_SECRET;
        if (gongKey && gongSecret) {
            this.gongAuth = Buffer.from(`${gongKey}:${gongSecret}`).toString('base64');
            console.log("✅ Gong API integration enabled");
        } else {
            console.log("⚠️  No Gong credentials found, using mock data");
        }

        this.app.listen(port, () => {
            console.log(`🚀 Miro + Gong HTTP MCP Service running on port ${port}`);
            console.log(`📊 Available tools: ${this.gongAuth ? 'Miro + Gong' : 'Miro (Gong mock)'}`);
        });
    }
}

// Start the service if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const service = new MiroHTTPService();
    service.start();
}

export { MiroHTTPService };