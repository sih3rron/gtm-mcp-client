#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { MiroClient } from './miro-client';

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

// Template categories from your existing code
const TEMPLATE_CATEGORIES = {
  "workshops": {
    keywords: [
      "workshop", "facilitation", "meeting", "collaboration", "team building",
      "icebreaker", "session", "attendees", "participants", "discussion",
      "facilitated", "breakout", "group exercise", "team activity"
    ],
    semanticDescription: "Activities and structures for facilitating group sessions, team building, and collaborative work",
    templates: [
      { name: "Workshop Agenda", url: "https://miro.com/templates/meeting-agenda/", description: "Structure your workshop sessions effectively" },
      { name: "Icebreaker Activities", url: "https://miro.com/templates/workshop-icebreaker-activities/", description: "Energize your team and break the ice" },
      { name: "Team Charter", url: "https://miro.com/templates/team-charter/", description: "Define team purpose, roles, and working agreements" },
      { name: "Event Planning", url: "https://miro.com/templates/event-planning/", description: "Plan and organize events with a visual checklist" },
      { name: "Team Meeting Agenda", url: "https://miro.com/templates/team-meeting-agenda/", description: "Structure team meetings with clear goals and action items" },
      { name: "One-on-one Meeting", url: "https://miro.com/templates/one-on-one-meeting/", description: "Structure productive one-on-one meetings" },
      { name: "Parking Lot Matrix", url: "https://miro.com/templates/ideas-parking-lot-matrix/", description: "Organize and prioritize ideas during meetings" },
      { name: "Design Sprint", url: "https://miro.com/templates/5-day-design-sprint/", description: "Run a 5-day design sprint workshop" },
      { name: "Meet the Team Template", url: "https://miro.com/templates/meet-the-team/", description: "Highlight your team members by showcasing their talents and expertise." }
    ]
  },
  "brainstorming": {
    keywords: [
      "ideas", "creativity", "innovation", "brainstorm", "ideation", "concepts",
      "mind map", "creative thinking", "generate ideas", "explore options",
      "think outside", "creative session", "idea generation"
    ],
    semanticDescription: "Tools and frameworks for generating, organizing, and developing creative ideas",
    templates: [
      { name: "Mind Map", url: "https://miro.com/templates/mind-map/", description: "Visualize ideas and their connections" },
      { name: "Affinity Diagram", url: "https://miro.com/templates/affinity-diagram/", description: "Organize and consolidate information from brainstorming sessions" },
      { name: "Parking Lot Matrix Template", url: "https://miro.com/templates/ideas-parking-lot-matrix/", description: "Keep team meetings focused by managing ideas, distractions, and side discussions." },
      { name: "Fishbone Diagram", url: "https://miro.com/templates/fishbone-diagram/", description: "Identify root causes of problems" },
      { name: "Likert Scale", url: "https://miro.com/templates/likert-scale/", description: "Measure subjective data and gather feedback" },
      { name: "Brainwriting", url: "https://miro.com/templates/brainwriting/", description: "Generate ideas individually before sharing" },
      { name: "SCAMPER", url: "https://miro.com/templates/scamper/", description: "Use SCAMPER technique for creative thinking" },
      { name: "Six Thinking Hats", url: "https://miro.com/templates/six-thinking-hats/", description: "Explore different perspectives in problem-solving" },
      { name: "Random Words", url: "https://miro.com/templates/random-words/", description: "Generate new ideas, solve problems, and create clearer solutions outside your comfort zone." },
      { name: "Reverse Brainstorming", url: "https://miro.com/templates/reverse-brainstorming/", description: "Solve problems by thinking in reverse" }
    ]
  },
  "research": {
    keywords: [
      "research", "user research", "market research", "customer insights",
      "user experience", "ux", "design research", "user testing",
      "customer journey", "persona", "user feedback"
    ],
    semanticDescription: "Tools for conducting and organizing user research, market analysis, and design research",
    templates: [
      { name: "Customer Journey Map", url: "https://miro.com/templates/customer-journey-map/", description: "Visualize user interactions and pain points" },
      { name: "Customer Touchpoint Map", url: "https://miro.com/templates/customer-touchpoint-map/", description: "Map customer interactions across different channels" },
      { name: "Service Blueprint", url: "https://miro.com/templates/service-blueprint/", description: "Design and optimize service experiences" },
      { name: "User Persona", url: "https://miro.com/templates/personas/", description: "Create detailed user profiles and characteristics" },
      { name: "Empathy Map", url: "https://miro.com/templates/empathy-map/", description: "Understand user needs and emotions" },
      { name: "User Interview", url: "https://miro.com/templates/user-interview/", description: "Structure and conduct user interviews" },
      { name: "Competitive Analysis", url: "https://miro.com/templates/competitive-analysis/", description: "Analyze competitors and market position" },
      { name: "Research Insights Synthesis", url: "https://miro.com/templates/research-insight-synthesis/", description: "Organize and synthesize research findings" },
      { name: "User Research Kick-Off Canvas", url: "https://miro.com/templates/user-research-kick-off-canvas/", description: "Plan and organize user research activities" }
    ]
  },
  "strategic_planning": {
    keywords: [
      "strategy", "planning", "roadmap", "business model", "goals",
      "objectives", "vision", "mission", "strategy planning",
      "business planning", "market analysis"
    ],
    semanticDescription: "Frameworks and tools for strategic business planning and analysis",
    templates: [
      { name: "Business Model Canvas", url: "https://miro.com/templates/business-model-canvas/", description: "Develop and display your business model" },
      { name: "Technology Roadmap", url: "https://miro.com/templates/technology-roadmap/", description: "Plan technology implementation and improvements" },
      { name: "Go-to-Market Strategy", url: "https://miro.com/templates/go-to-market-strategy/", description: "Plan product launch and market entry" },
      { name: "Marketing Funnel", url: "https://miro.com/templates/marketing-funnel/", description: "Visualize and optimize marketing processes" },
      { name: "Content Strategy", url: "https://miro.com/templates/content-strategy/", description: "Plan and organize content creation and distribution" },
      { name: "SWOT Analysis", url: "https://miro.com/templates/swot-analysis/", description: "Analyze strengths, weaknesses, opportunities, and threats" },
      { name: "Porter's Five Forces", url: "https://miro.com/templates/porters-five-forces/", description: "Analyze competitive forces in your industry" },
      { name: "Thematic Roadmapping (Vision & Strategy)", url: "https://miro.com/templates/thematic-roadmapping-vision-strategy/", description: "Are you ready to embark on a journey that will transform your team's strategy and alignment?" },
      { name: "OKR Planning", url: "https://miro.com/templates/okr-planning/", description: "Facilitate OKR planning sessions and keep your team aligned with your organization's goals." },
      { name: "Vision Board", url: "https://miro.com/templates/vision-board/", description: "Visualize and communicate strategic vision" }
    ]
  },
  "agile": {
    keywords: [
      "sprint", "scrum", "agile", "retrospective", "standup", "backlog",
      "user stories", "kanban", "velocity", "story points", "sprint planning",
      "daily standup", "sprint review", "burndown", "epic", "feature"
    ],
    semanticDescription: "Tools and frameworks for agile project management and development",
    templates: [
      { name: "Agile Board", url: "https://miro.com/templates/agile-board/", description: "Manage tasks and track progress in agile projects" },
      { name: "Sprint Planning", url: "https://miro.com/templates/sprint-planning/", description: "Plan your next sprint effectively" },
      { name: "Retrospective", url: "https://miro.com/templates/retrospective/", description: "Reflect on team performance and improve" },
      { name: "Conversion Funnel Backlog", url: "https://miro.com/templates/conversion-funnel-backlog/", description: "Structure backlog around conversion funnel" },
      { name: "Kanban Framework Template", url: "https://miro.com/templates/kanban-framework/", description: "Improve processes and team efficiency by managing your workflow in a flexible and visual way." },
      { name: "User Story Mapping Template", url: "https://miro.com/templates/user-story-mapping-with-walkthrough/", description: "The Bluefruit Software user story mapping template offers a framework to help businesses prioritise software development." },
      { name: "Sprint Review", url: "https://miro.com/templates/sprint-review/", description: "Review sprint outcomes and demonstrate work" },
      { name: "Daily Standup", url: "https://miro.com/templates/daily-standup/", description: "Conduct effective daily standup meetings" },
      { name: "Agile Roadmap", url: "https://miro.com/templates/agile-roadmap/", description: "Plan and visualize agile project timeline" }
    ]
  },
  "mapping": {
    keywords: [
      "mapping", "diagram", "flowchart", "process", "workflow",
      "swimlane", "stakeholder", "uml", "system", "architecture"
    ],
    semanticDescription: "Tools for creating various types of diagrams and visual maps",
    templates: [
      { name: "UML Diagram", url: "https://miro.com/templates/uml-diagram/", description: "Model business processes and software architecture" },
      { name: "Swimlane Diagram Template", url: "https://miro.com/templates/swimlanes-diagram/", description: "Clarify roles and replace lengthy written processes with visuals." },
      { name: "Stakeholder Mapping", url: "https://miro.com/templates/stakeholder-map-basic/", description: "Identify and map out the people involved in a project, gain buy-in, and accomplish your goals." },
      { name: "Flowchart", url: "https://miro.com/templates/flowchart/", description: "Visualize processes and workflows" },
      { name: "Process Map", url: "https://miro.com/templates/process-map/", description: "Document and analyze business processes" },
      { name: "AWS Architecture Diagram Template", url: "https://miro.com/templates/aws-architecture-diagram/", description: "Translate Amazon Web Services architecture best practice into a visual format." },
      { name: "Google Cloud Architecture Diagram Template", url: "https://miro.com/templates/gcp-architecture/", description: "Visualize the deployment of your applications and optimize your processes." },
      { name: "Kubernetes Architecture Diagram Template", url: "https://miro.com/templates/kubernetes-diagram/", description: "Map out your application deployments and streamline your processes." },
      { name: "GenAI Application Workflow", url: "https://miro.com/templates/genai-application-workflow/", description: "This template will allow you to build custom Lamatic workflow and make the onboarding faster." },
      { name: "Business Case Canvas", url: "https://miro.com/templates/simple-business-case/", description: "Use the Business Case Template to cover all the key elements of your idea and easily get buy-in from stakeholders. Impress everyone with your project and achieve success." }
    ]
  }
} as const;

console.log(process.env.MIRO_ACCESS_TOKEN);

type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES;

// Gong API Configuration
const GONG_API_BASE = 'https://us-45594.api.gong.io/v2';

class MiroHTTPService {
    private app: express.Application;
    private miroClient?: MiroClient;
    private gongAuth?: string;

    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Debug environment variables
        console.log("Environment variables check:");
        console.log("MIRO_ACCESS_TOKEN exists:", !!process.env.MIRO_ACCESS_TOKEN);
        console.log("MIRO_ACCESS_TOKEN length:", process.env.MIRO_ACCESS_TOKEN?.length || 0);
        console.log("All env vars starting with MIRO:", Object.keys(process.env).filter(key => key.startsWith('MIRO')));

        // Initialize MiroClient if access token is available
        const accessToken = process.env.MIRO_ACCESS_TOKEN;
        if (accessToken) {
            this.miroClient = new MiroClient(accessToken);
            console.log("Miro API integration enabled");
        } else {
            console.log("No Miro access token found, using mock data");
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
                gong: !!this.gongAuth
            });
        });

        // List available tools
        this.app.get('/tools', (req, res) => {
            const tools = [
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
                        },
                        anyOf: [
                            { required: ["boardId"] },
                            { required: ["meetingNotes"] }
                        ]
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
                    description: "Search Gong calls by customer name and date range, returns matching calls for user selection",
                    inputSchema: {
                        type: "object",
                        properties: {
                            customerName: { type: "string", description: "Customer name to search for (fuzzy match in call title)" },
                            fromDate: { type: "string", description: "Start date (ISO 8601, optional, defaults to 3 months ago)" },
                            toDate: { type: "string", description: "End date (ISO 8601, optional, defaults to today)" }
                        },
                        required: ["customerName"]
                    }
                },
                {
                    name: "select_gong_call",
                    description: "Select a specific call from search results by selection number or direct call ID",
                    inputSchema: {
                        type: "object",
                        properties: {
                            callId: { type: "string", description: "Direct Gong call ID to select" },
                            selectionNumber: { type: "number", description: "Selection number from search results (1, 2, 3, etc.)" },
                            customerName: { type: "string", description: "Original customer name used in search (required when using selectionNumber)" }
                        },
                        anyOf: [
                            { required: ["callId"] },
                            { required: ["selectionNumber", "customerName"] }
                        ]
                    }
                },
                {
                    name: "get_gong_call_details",
                    description: "Fetch highlights and keypoints for a Gong call by callId",
                    inputSchema: {
                        type: "object",
                        properties: {
                            callId: { type: "string", description: "The Gong call ID" }
                        },
                        required: ["callId"]
                    }
                }
            ];

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

    private async searchGongCalls(args: any) {
        const { customerName, fromDate, toDate } = args;
        const now = new Date();
        let from: Date, to: Date;

        if (fromDate) {
            from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
        } else {
            from = new Date(now);
            from.setMonth(now.getMonth() - 2);
            from.setHours(0, 0, 0, 0);
        }

        if (toDate) {
            to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
        } else {
            to = new Date(now);
            to.setHours(23, 59, 59, 999);
        }

        const fromISO = from.toISOString();
        const toISO = to.toISOString();
        let calls: any[];

        if (!this.gongAuth) {
            // Mock data
            calls = [
                {
                    id: "call_001",
                    title: `${customerName} - Q1 Planning Session`,
                    url: "https://app.gong.io/call/call_001",
                    started: "2025-01-23T10:00:00Z",
                    primaryUserId: "user_123",
                    duration: 3600,
                    parties: ["john.doe@company.com", `manager@${customerName.toLowerCase().replace(/\s+/g, '')}.com`]
                },
                {
                    id: "call_002",
                    title: `${customerName} - Infrastructure Review`,
                    url: "https://app.gong.io/call/call_002",
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
            calls = (data?.calls || []).map((c: any) => ({
                id: c.id,
                title: c.title,
                url: c.url,
                started: c.started,
                primaryUserId: c.primaryUserId,
                duration: c.duration,
                parties: c.parties || []
            }));
        }

        const wordRegex = new RegExp(`\\b${customerName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
        let matches = calls.filter(call => wordRegex.test(call.title))
            .map(call => ({ ...call, matchType: 'exact', score: 100 }));

        if (matches.length === 0) {
            matches = calls.filter(call => this.flexibleMatch(call.title, customerName))
                .map(call => ({
                    ...call,
                    matchType: 'fuzzy',
                    score: this.calculateMatchScore(call.title, customerName)
                }));
        }

        matches.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return new Date(b.started).getTime() - new Date(a.started).getTime();
        });

        const formattedMatches = matches.map((call, index) => ({
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
            participants: call.parties?.length || 0,
            matchType: call.matchType,
            score: call.score,
            url: call.url
        }));

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
                    url: `https://app.gong.io/call/${callId}`
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

    private async getGongCallDetails(args: any) {
        const { callId } = args;

        if (!this.gongAuth) {
            return {
                callId,
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
                nextSteps: [
                    "Schedule technical demo for next week",
                    "Send detailed pricing proposal",
                    "Connect with customer's technical team"
                ],
                mock: true
            };
        }

        try {
            const postBody = {
                filter: { callIds: [callId] },
                contentSelector: {
                    exposedFields: {
                        parties: true,
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

            const data = await this.gongPost('/calls/extensive', postBody);
            const call = data.calls?.[0] || data;
            const content = call.content || {};

            return {
                callId,
                highlights: content.highlights || ["No highlights available"],
                keyPoints: content.keyPoints || ["No key points available"],
                brief: content.brief || "No brief available",
                outline: content.outline || "No outline available"
            };

        } catch (error) {
            console.error('Error getting Gong call details:', error);
            throw new Error(`Failed to get call details: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                ...(includeTemplateRecommendations && {
                    templates: result.templateRecommendations?.map(t => ({
                        name: t.name,
                        url: t.url,
                        category: t.category
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

        const analysis = this.analyzeContent(content);
        const recommendations = this.generateRecommendations(analysis, maxRecommendations);

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

    private analyzeContent(content: string[]): {
        keywords: string[];
        categories: TemplateCategory[];
        context: string;
    } {
        const allText = content.join(" ").toLowerCase();
        const foundKeywords: string[] = [];
        const categoryScores: { [key: string]: number } = {};

        for (const [category, categoryData] of Object.entries(TEMPLATE_CATEGORIES)) {
            const matchingKeywords = categoryData.keywords.filter(keyword =>
                allText.includes(keyword.toLowerCase())
            );

            if (matchingKeywords.length > 0) {
                foundKeywords.push(...matchingKeywords);
                categoryScores[category] = matchingKeywords.length;
            }
        }

        const sortedCategories = Object.entries(categoryScores)
            .sort(([, a], [, b]) => b - a)
            .map(([category]) => category as TemplateCategory);

        const context = this.generateContextDescription(sortedCategories);

        return {
            keywords: [...new Set(foundKeywords)],
            categories: sortedCategories,
            context
        };
    }

    private generateRecommendations(
        analysis: { keywords: string[]; categories: TemplateCategory[]; context: string },
        maxRecommendations: number
    ) {
        const recommendations: any[] = [];

        for (const category of analysis.categories) {
            const categoryTemplates = TEMPLATE_CATEGORIES[category]?.templates || [];
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

    private generateContextDescription(categories: TemplateCategory[]): string {
        const contextMap: { [key: string]: string } = {
            "workshops": "Team collaboration and workshops"
        };

        const contexts = categories.slice(0, 3).map(cat => contextMap[cat]).filter(Boolean);
        return contexts.length > 0
            ? `Content appears to focus on: ${contexts.join(", ")}`
            : "General collaborative work";
    }

    private calculateRelevanceScore(keywords: string[], category: TemplateCategory): number {
        const categoryKeywords: readonly string[] = TEMPLATE_CATEGORIES[category]?.keywords ?? [];
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