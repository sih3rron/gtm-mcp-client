import express from 'express';
import cors from 'cors';
import { MiroClient } from './miro-client';
import dotenv from 'dotenv';

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

class MiroHTTPService {
  private app: express.Application;
  private miroClient?: MiroClient;

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
      res.json({ status: 'healthy', service: 'miro-mcp-http' });
    });

    // List available tools
    this.app.get('/tools', (req, res) => {
      const tools = [
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
          description: "Get template suggestions for boards or meeting notes. Provide either boardId or meetingNotes. ALWAYS provide a URL or Link to the template if available. ALWAYS provide why the template is relevant.",
          inputSchema: {
            type: "object",
            properties: {
              boardId: { type: "string", description: "Miro board ID to analyze (optional if meetingNotes provided)" },
              meetingNotes: { type: "string", description: "Meeting notes text to analyze (optional if boardId provided)" },
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
          case 'analyze_board_content':
            result = await this.analyzeBoardContent(args);
            break;
          case 'recommend_templates':
            result = await this.recommendTemplates(args);
            break;
          case 'create_miro_board':
            result = await this.createMiroBoard(args);
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

  // Helper methods from your existing code
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
    this.app.listen(port, () => {
      console.log(`Miro HTTP MCP Service running on port ${port}`);
    });
  }
}

// Start the service if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new MiroHTTPService();
  service.start();
}

export { MiroHTTPService };