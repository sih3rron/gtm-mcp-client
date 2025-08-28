import express from 'express';
import cors from 'cors';
import { MiroClient } from './miro-client';

// Template categories from your existing code
const TEMPLATE_CATEGORIES = {
  "workshops": {
    keywords: [
      "workshop", "facilitation", "meeting", "collaboration", "team building",
      "icebreaker", "session", "attendees", "participants", "discussion",
      "facilitated", "breakout", "group exercise", "team activity"
    ] as string[],
    templates: [
      { name: "Workshop Agenda", url: "https://miro.com/templates/meeting-agenda/", description: "Structure your workshop sessions effectively" },
      { name: "Icebreaker Activities", url: "https://miro.com/templates/workshop-icebreaker-activities/", description: "Energize your team and break the ice" },
      // ... other templates
    ]
  },
  // ... other categories (abbreviated for space)
};

type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES;

class MiroHTTPService {
  private app: express.Application;
  private miroClient?: MiroClient;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
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

    if (rawBoardId) {
      const boardId = this.extractBoardId(rawBoardId);
      
      if (!this.miroClient) {
        content = ["Sprint planning", "User stories", "Design system"];
      } else {
        content = await this.miroClient.getBoardContent(boardId);
      }
      contentType = "miro_board";
    } else if (meetingNotes) {
      content = this.parseMeetingNotes(meetingNotes);
      contentType = "meeting_notes";
    } else {
      throw new Error("Please provide either a Miro board ID or meeting notes text.");
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
    const categoryKeywords = TEMPLATE_CATEGORIES[category]?.keywords || [];
    const matches = keywords.filter(k => categoryKeywords.includes(k)).length;
    return matches / categoryKeywords.length;
  }

  public async start(port: number = 3001) {
    const accessToken = process.env.MIRO_ACCESS_TOKEN;
    if (accessToken) {
      this.miroClient = new MiroClient(accessToken);
      console.log("Miro API integration enabled");
    } else {
      console.log("No Miro access token found, using mock data");
    }

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