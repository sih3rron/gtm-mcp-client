// src/miro-client.ts
import axios from 'axios';

export interface MiroItem {
  id: string;
  type: string;
  data: {
    content?: string;
    text?: string;
    title?: string;
    format?: string;
    showContent?: boolean;
  };
  position: {
    x: number;
    y: number;
  };
  style?: any;
  geometry?: any;
  parent?: any;
  isSupported?: boolean;
}

export interface MiroBoardInfo {
  id: string;
  name: string;
  description?: string;
  items: MiroItem[];
}

export class MiroClient {
  private accessToken: string;
  private baseUrl = 'https://api.miro.com/v2';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  static extractBoardId(input: string): string {
    console.error(`[extractBoardId] Input: "${input}"`);
    
    // If it's already just a board ID, return as-is
    if (!input.includes('/') && !input.includes('miro.com')) {
      const normalized = input.endsWith('=') ? input : input + '=';
      console.error(`[extractBoardId] Direct ID normalized: "${normalized}"`);
      return normalized;
    }
    
    // Extract from URL patterns
    const urlPatterns = [
      /\/board\/([^\/\?#]+)/,  // /board/uXjVJY6fU2g=
      /\/app\/board\/([^\/\?#]+)/, // /app/board/uXjVJY6fU2g=
    ];
    
    for (const pattern of urlPatterns) {
      const match = input.match(pattern);
      if (match) {
        let boardId = decodeURIComponent(match[1]);
        // Ensure it ends with = for Miro board IDs
        const normalized = boardId.endsWith('=') ? boardId : boardId + '=';
        console.error(`[extractBoardId] Extracted from URL: "${normalized}"`);
        return normalized;
      }
    }
    
    // If no pattern matches, assume it's already a board ID
    const fallback = input.endsWith('=') ? input : input + '=';
    console.error(`[extractBoardId] Fallback: "${fallback}"`);
    return fallback;
  }

  private async makeRequest(endpoint: string, usePagination: boolean = false): Promise<any> {
    try {
      if (!usePagination) {
        // Single request without pagination
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      }

      // Handle pagination with cursor
      let allData: any[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }

        const response = await axios.get(url.toString(), {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        const responseData = response.data;

        // Handle different response structures
        if (responseData.data && Array.isArray(responseData.data)) {
          // Standard paginated response with data array
          allData = allData.concat(responseData.data);
          cursor = responseData.cursor || null;
          hasMore = !!cursor;
        } else if (Array.isArray(responseData)) {
          // Direct array response
          allData = allData.concat(responseData);
          hasMore = false; // No pagination info, assume single page
        } else {
          // Single object or other structure
          allData.push(responseData);
          hasMore = false;
        }
      }

      // Return the same structure as the original response but with all data
      if (allData.length === 1 && !Array.isArray(allData[0])) {
        return allData[0]; // Return single object
      }
      return { data: allData }; // Return array wrapped in data property
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  async getBoardInfo(boardId: string): Promise<MiroBoardInfo> {
    try {
      // Get board details
      const boardResponse = await this.makeRequest(`/boards/${boardId}`);

      // Get board items with pagination
      const itemsResponse = await this.makeRequest(`/boards/${boardId}/items`, true);

      return {
        id: boardResponse.id,
        name: boardResponse.name,
        description: boardResponse.description,
        items: itemsResponse.data || []
      };
    } catch (error) {
      throw new Error(`Failed to fetch board info: ${(error as Error).message}`);
    }
  }

  async getBoardContent(boardId: string): Promise<string[]> {
    try {
      const boardInfo = await this.getBoardInfo(boardId);
      const rawContent: string[] = [];

      // Extract text content from various item types
      for (const item of boardInfo.items) {
        const textContent = this.extractTextFromItem(item);
        if (textContent) {
          rawContent.push(textContent);
        }
      }

      // Add board name and description
      if (boardInfo.name) {
        rawContent.unshift(boardInfo.name);
      }
      if (boardInfo.description) {
        rawContent.push(boardInfo.description);
      }

      console.error(`[getBoardContent] Raw content extracted: ${rawContent.length} items`);

      // Apply summarization to reduce token usage
      const { summary } = this.summarizeContent(rawContent, 15); // Limit to 15 most relevant items

      console.error(`[getBoardContent] Summarized to: ${summary.length} items`);

      return summary;
    } catch (error) {
      throw new Error(`Failed to extract board content: ${(error as Error).message}`);
    }
  }

  /**
 * Comprehensive board analysis with built-in content summarization and template recommendations
 * This reduces token usage and API round trips by bundling common operations
 */
  async getSmartBoardAnalysis(boardId: string, options: {
    maxContent?: number;
    includeTemplateRecommendations?: boolean;
    maxTemplateRecommendations?: number;
  } = {}): Promise<{
    boardInfo: {
      id: string;
      name: string;
      itemCount: number;
      itemTypes: string[];
    };
    contentSummary: {
      keyContent: string[];
      contentStats: {
        total: number;
        summarized: number;
        skipped: number;
      };
    };
    analysis: {
      detectedKeywords: string[];
      identifiedCategories: string[];
      context: string;
    };
    templateRecommendations?: Array<{
      name: string;
      url: string;
      category: string;
      relevanceScore: number;
    }>;
  }> {
    const {
      maxContent = 15,
      includeTemplateRecommendations = true,
      maxTemplateRecommendations = 5
    } = options;

    try {
      // Get board info and extract content in one go
      const boardInfo = await this.getBoardInfo(boardId);
      const rawContent: string[] = [];

      // Extract and process content
      for (const item of boardInfo.items) {
        const textContent = this.extractTextFromItem(item);
        if (textContent) {
          rawContent.push(textContent);
        }
      }

      // Add board metadata
      if (boardInfo.name) rawContent.unshift(boardInfo.name);
      if (boardInfo.description) rawContent.push(boardInfo.description);

      console.error(`[getSmartBoardAnalysis] Processing ${rawContent.length} items for board ${boardId}`);

      // Summarize content efficiently
      const { summary, contentStats } = this.summarizeContent(rawContent, maxContent);

      // Analyze summarized content for keywords and patterns
      const analysis = this.analyzeContentForTemplates(summary);

      // Prepare basic response
      const response: any = {  // Add ': any' here to fix the conditional property issue
        boardInfo: {
          id: boardInfo.id,
          name: boardInfo.name,
          itemCount: boardInfo.items.length,
          itemTypes: [...new Set(boardInfo.items.map(item => item.type))]
        },
        contentSummary: {
          keyContent: summary,
          contentStats
        },
        analysis
      };

      // Add template recommendations if requested
      if (includeTemplateRecommendations) {
        response.templateRecommendations = this.generateTemplateRecommendations(analysis, maxTemplateRecommendations);
      }

      console.error(`[getSmartBoardAnalysis] Completed analysis: ${summary.length} content items, ${analysis.detectedKeywords.length} keywords`);

      return response;
    } catch (error) {
      throw new Error(`Failed to perform smart board analysis: ${(error as Error).message}`);
    }
  }

  /**
   * Analyzes content for template matching keywords and categories
   */
  private analyzeContentForTemplates(content: string[]): {
    detectedKeywords: string[];
    identifiedCategories: string[];
    context: string;
  } {
    const allText = content.join(" ").toLowerCase();
    const foundKeywords: string[] = [];
    const categoryScores: { [key: string]: number } = {};

    // Template categories (simplified version for efficiency)
    const templateCategories = {
      "workshops": ["workshop", "facilitation", "meeting", "collaboration", "team building", "icebreaker", "session"],
      "brainstorming": ["ideas", "creativity", "innovation", "brainstorm", "ideation", "concepts", "mind map"],
      "research": ["research", "user research", "customer insights", "user experience", "ux", "persona"],
      "strategic_planning": ["strategy", "planning", "roadmap", "business model", "goals", "objectives", "vision"],
      "agile": ["sprint", "scrum", "agile", "retrospective", "standup", "backlog", "user stories", "kanban"],
      "mapping": ["mapping", "diagram", "flowchart", "process", "workflow", "swimlane", "stakeholder"]
    };

    // Find matching keywords and score categories
    for (const [category, keywords] of Object.entries(templateCategories)) {
      const matchingKeywords = keywords.filter(keyword => allText.includes(keyword));
      if (matchingKeywords.length > 0) {
        foundKeywords.push(...matchingKeywords);
        categoryScores[category] = matchingKeywords.length;
      }
    }

    // Sort categories by relevance
    const sortedCategories = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category);

    // Generate context description
    const context = sortedCategories.length > 0
      ? `Content appears to focus on: ${sortedCategories.slice(0, 3).join(", ")}`
      : "General collaborative work";

    return {
      detectedKeywords: [...new Set(foundKeywords)],
      identifiedCategories: sortedCategories,
      context
    };
  }

  private generateTemplateRecommendations(
    analysis: { detectedKeywords: string[]; identifiedCategories: string[] },
    maxRecommendations: number
  ): Array<{ name: string; url: string; category: string; relevanceScore: number }> {

    // Simplified template database for efficiency - with proper typing
    const templates: Record<string, Array<{ name: string; url: string }>> = {
      "workshops": [
        { name: "Workshop Agenda", url: "https://miro.com/templates/meeting-agenda/" },
        { name: "Icebreaker Activities", url: "https://miro.com/templates/workshop-icebreaker-activities/" },
        { name: "Team Charter", url: "https://miro.com/templates/team-charter/" }
      ],
      "brainstorming": [
        { name: "Mind Map", url: "https://miro.com/templates/mind-map/" },
        { name: "Affinity Diagram", url: "https://miro.com/templates/affinity-diagram/" },
        { name: "SCAMPER", url: "https://miro.com/templates/scamper/" }
      ],
      "research": [
        { name: "Customer Journey Map", url: "https://miro.com/templates/customer-journey-map/" },
        { name: "User Persona", url: "https://miro.com/templates/personas/" },
        { name: "Empathy Map", url: "https://miro.com/templates/empathy-map/" }
      ],
      "strategic_planning": [
        { name: "Business Model Canvas", url: "https://miro.com/templates/business-model-canvas/" },
        { name: "SWOT Analysis", url: "https://miro.com/templates/swot-analysis/" },
        { name: "OKR Planning", url: "https://miro.com/templates/okr-planning/" }
      ],
      "agile": [
        { name: "Sprint Planning", url: "https://miro.com/templates/sprint-planning/" },
        { name: "Retrospective", url: "https://miro.com/templates/retrospective/" },
        { name: "Kanban Framework", url: "https://miro.com/templates/kanban-framework/" }
      ],
      "mapping": [
        { name: "Flowchart", url: "https://miro.com/templates/flowchart/" },
        { name: "Process Map", url: "https://miro.com/templates/process-map/" },
        { name: "Stakeholder Mapping", url: "https://miro.com/templates/stakeholder-map-basic/" }
      ]
    };

    const recommendations: Array<{ name: string; url: string; category: string; relevanceScore: number }> = [];

    // Generate recommendations based on identified categories
    for (const category of analysis.identifiedCategories.slice(0, 3)) { // Top 3 categories only
      const categoryTemplates = templates[category] || [];
      for (const template of categoryTemplates.slice(0, 2)) { // Top 2 templates per category
        recommendations.push({
          name: template.name,
          url: template.url,
          category,
          relevanceScore: this.calculateTemplateRelevance(analysis.detectedKeywords, category)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxRecommendations);
  }

  private calculateTemplateRelevance(keywords: string[], category: string): number {
    const categoryKeywords: Record<string, string[]> = {
      "workshops": ["workshop", "facilitation", "meeting", "collaboration"],
      "brainstorming": ["ideas", "creativity", "innovation", "brainstorm"],
      "research": ["research", "user", "customer", "ux"],
      "strategic_planning": ["strategy", "planning", "business", "goals"],
      "agile": ["sprint", "scrum", "agile", "retrospective"],
      "mapping": ["mapping", "diagram", "process", "workflow"]
    };

    const relevantKeywords = categoryKeywords[category] || [];
    const matches = keywords.filter(k => relevantKeywords.includes(k)).length;
    return Math.min((matches / relevantKeywords.length) * 100, 100);
  }

  // Replace this helper method:
private extractTextContent(item: any): string | null {
  // This should call the existing MiroClient method
  // But we can't access it directly from the server class
  
  // Instead, implement a simplified version here:
  if (item.isSupported === false) return null;

  switch (item.type) {
    case 'text':
    case 'sticky_note':
      if (item.data?.content) {
        return this.cleanHtmlContent(item.data.content);
      }
      return item.data?.text || null;
    case 'card':
      const title = item.data?.title || '';
      const content = item.data?.content ? this.cleanHtmlContent(item.data.content) : '';
      return [title, content].filter(Boolean).join(' - ') || null;
    case 'frame':
      return item.data?.title || null;
    default:
      return null;
  }
}

  private extractTextFromItem(item: MiroItem): string | null {
    // Skip unsupported items
    if (item.isSupported === false) {
      return null;
    }

    // Handle different item types based on actual Miro API structure
    switch (item.type) {
      case 'text':
      case 'sticky_note':
        // For text items, check data.content first, then try to parse HTML content
        if (item.data?.content) {
          return this.cleanHtmlContent(item.data.content);
        }
        return item.data?.text || null;

      case 'shape':
        // Shapes might have content in data.content
        if (item.data?.content) {
          return this.cleanHtmlContent(item.data.content);
        }
        return null;

      case 'card':
        // Cards typically have title and content
        const cardTitle = item.data?.title || '';
        const cardContent = item.data?.content ? this.cleanHtmlContent(item.data.content) : '';
        return [cardTitle, cardContent].filter(Boolean).join(' - ') || null;

      case 'frame':
        // Frames have titles
        return item.data?.title || null;

      case 'image':
      case 'unknown':
        // Skip images and unknown types for text content
        return null;

      default:
        // Try to extract any available text content
        const availableContent = [
          item.data?.title,
          item.data?.content ? this.cleanHtmlContent(item.data.content) : null,
          item.data?.text
        ].filter(Boolean);

        return availableContent.length > 0 ? availableContent.join(' ') : null;
    }
  }

  private cleanHtmlContent(htmlContent: string): string {
    if (!htmlContent) return '';

    // Remove HTML tags and decode common entities
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Decode ampersands
      .replace(/&lt;/g, '<') // Decode less than
      .replace(/&gt;/g, '>') // Decode greater than
      .replace(/&quot;/g, '"') // Decode quotes
      .replace(/&#39;/g, "'") // Decode apostrophes
      .trim();
  }


  /**
   * Summarizes board content to reduce token usage while maintaining relevance
   * @param content Array of all extracted content
   * @param maxItems Maximum number of items to return (default: 20)
   */

  private summarizeContent(content: string[], maxItems: number = 20): {
    summary: string[];
    contentStats: { total: number; summarized: number; skipped: number };
  } {
    console.error(`[summarizeContent] Processing ${content.length} items`);

    // Step 1: Filter out noise and very short/long content
    const meaningfulContent = content.filter(item => {
      if (!item || typeof item !== 'string') return false;
      const trimmed = item.trim();

      // Skip very short items (likely noise)
      if (trimmed.length < 3) return false;

      // Skip very long items (likely to consume many tokens)
      if (trimmed.length > 300) return false;

      // Skip URLs and obvious noise
      if (/^https?:\/\//.test(trimmed)) return false;
      if (/^[^\w\s]*$/.test(trimmed)) return false; // Only punctuation
      if (/^(.)\1{3,}$/.test(trimmed)) return false; // Repeated characters

      return true;
    });

    console.error(`[summarizeContent] After filtering: ${meaningfulContent.length} items`);

    // Step 2: Remove near-duplicates
    const uniqueContent = this.removeSimilarContent(meaningfulContent);
    console.error(`[summarizeContent] After deduplication: ${uniqueContent.length} items`);

    // Step 3: Prioritize by relevance
    const prioritized = this.prioritizeContent(uniqueContent);

    // Step 4: Take only the top items
    const summary = prioritized.slice(0, maxItems);

    return {
      summary,
      contentStats: {
        total: content.length,
        summarized: summary.length,
        skipped: content.length - summary.length
      }
    };
  }

  /**
   * Removes content items that are very similar to avoid redundancy
   */
  private removeSimilarContent(content: string[]): string[] {
    const unique: string[] = [];

    for (const item of content) {
      const normalized = item.toLowerCase().trim();

      // Check if this item is too similar to anything we already have
      const isDuplicate = unique.some(existing => {
        const existingNormalized = existing.toLowerCase().trim();

        // Exact match
        if (normalized === existingNormalized) return true;

        // Very high similarity (80%+)
        const similarity = this.calculateSimilarity(existingNormalized, normalized);
        return similarity > 0.8;
      });

      if (!isDuplicate) {
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Scores content by relevance - higher scores = more likely to be meaningful
   */
  private prioritizeContent(content: string[]): string[] {
    return content
      .map(item => ({
        content: item,
        score: this.getContentRelevanceScore(item)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.content);
  }

  /**
   * Calculates how "relevant" a piece of content is likely to be
   */
  private getContentRelevanceScore(content: string): number {
    let score = 0;
    const words = content.split(/\s+/);
    const length = content.length;

    // Length scoring - sweet spot is 10-100 characters
    if (length >= 10 && length <= 100) score += 3;
    else if (length > 100 && length <= 200) score += 1;

    // Multiple words are generally more meaningful than single words
    if (words.length > 1) score += 2;
    if (words.length >= 4) score += 1;

    // Business/project terminology boost
    const businessTerms = [
      'project', 'task', 'goal', 'team', 'strategy', 'plan', 'idea', 'issue',
      'solution', 'user', 'customer', 'feature', 'requirement', 'sprint',
      'meeting', 'action', 'decision', 'risk', 'opportunity'
    ];

    const lowerContent = content.toLowerCase();
    const matchingTerms = businessTerms.filter(term => lowerContent.includes(term));
    score += matchingTerms.length * 2;

    // Question format often indicates important content
    if (content.includes('?')) score += 1;

    // Avoid obvious noise patterns
    if (/^(untitled|new|item|text|note|card)\s*\d*$/i.test(content)) score -= 5;
    if (/^\d+$/.test(content)) score -= 3; // Just numbers

    return score;
  }

  /**
   * Calculates similarity between two strings using Levenshtein distance
   * Returns a value between 0 (completely different) and 1 (identical)
   */

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,         // deletion
          matrix[i][j - 1] + 1,         // insertion
          matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
      }
    }

    // Convert distance to similarity score
    const distance = matrix[a.length][b.length];
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  async getItemsByType(boardId: string, itemType: string): Promise<MiroItem[]> {
    try {
      const response = await this.makeRequest(`/boards/${boardId}/items?type=${itemType}`, true);
      return response.data || [];
    } catch (error) {
      throw new Error(`Failed to fetch items of type ${itemType}: ${(error as Error).message}`);
    }
  }

  // Add method to get all sticky notes specifically
  async getStickyNotes(boardId: string): Promise<string[]> {
    try {
      const stickyNotes = await this.getItemsByType(boardId, 'sticky_note');
      return stickyNotes
        .map(note => this.extractTextFromItem(note))
        .filter((content): content is string => content !== null);
    } catch (error) {
      throw new Error(`Failed to fetch sticky notes: ${(error as Error).message}`);
    }
  }

  // Add method to get all text items specifically
  async getTextItems(boardId: string): Promise<string[]> {
    try {
      const textItems = await this.getItemsByType(boardId, 'text');
      return textItems
        .map(item => this.extractTextFromItem(item))
        .filter((content): content is string => content !== null);
    } catch (error) {
      throw new Error(`Failed to fetch text items: ${(error as Error).message}`);
    }
  }

  // Create a new Miro board
  async createBoard(name: string, description?: string, sharingPolicy?: any): Promise<any> {
    try {
      const payload: any = { name };
      if (description) payload.description = description;
      if (sharingPolicy) payload.policy = { sharingPolicy };
      const response = await axios.post(
        `${this.baseUrl}/boards`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Update item position or parent
  async updateItemPositionOrParent(boardId: string, itemId: string, position: { x: number, y: number }, parentId?: string): Promise<any> {
    try {
      const payload: any = { position };
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.patch(
        `${this.baseUrl}/boards/${boardId}/items/${itemId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Create a new frame on a board
  async createFrame(boardId: string, title: string, x: number, y: number, width: number, height: number): Promise<any> {
    try {
      const payload: any = {
        data: { title },
        position: { x, y },
        geometry: { width, height }
      };
      const response = await axios.post(
        `${this.baseUrl}/boards/${boardId}/frames`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Get a specific frame item
  async getFrame(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/boards/${boardId}/frames/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Update a specific frame item
  async updateFrame(boardId: string, itemId: string, data?: any, style?: any, geometry?: any): Promise<any> {
    try {
      const payload: any = {};
      if (data) payload.data = data;
      if (style) payload.style = style;
      if (geometry) payload.geometry = geometry;
      const response = await axios.patch(
        `${this.baseUrl}/boards/${boardId}/frames/${itemId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Delete a specific frame item
  async deleteFrame(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/boards/${boardId}/frames/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, status: response.status };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Create a new text item
  async createText(boardId: string, data: any, position: { x: number, y: number }, geometry?: { width: number }, style?: any, parentId?: string): Promise<any> {
    try {
      const payload: any = {
        data,
        position,
      };

      if (geometry) payload.geometry = geometry;
      if (style) payload.style = style;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.post(
        `${this.baseUrl}/boards/${boardId}/texts`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Get a specific text item
  async getTextItem(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/boards/${boardId}/texts/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Update a specific text item
  async updateText(boardId: string, itemId: string, data?: any, style?: any, geometry?: { width: number }, parentId?: string): Promise<any> {
    try {
      const payload: any = {
        data,
        style,
        parent,
      };
      if (data) payload.data = data;
      if (style) payload.style = style;
      if (geometry) payload.geometry = geometry;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.patch(
        `${this.baseUrl}/boards/${boardId}/texts/${itemId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Delete a specific text item
  async deleteText(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/boards/${boardId}/texts/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, status: response.status };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Create a new sticky note
  async createSticky(boardId: string, data: any, position: { x: number, y: number, }, geometry?: { width: number, height: number }, style?: any, parentId?: string): Promise<any> {
    try {
      const payload: any = {
        data,
        position
      };
      if (geometry) payload.geometry = geometry;
      if (style) payload.style = style;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.post(
        `${this.baseUrl}/boards/${boardId}/sticky_notes`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Get a specific sticky note
  async getSticky(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/boards/${boardId}/sticky_notes/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Update a specific sticky note
  async updateSticky(boardId: string, itemId: string, data?: any, style?: any, geometry?: { width: number, height: number }, parentId?: string): Promise<any> {
    try {
      const payload: any = {};
      if (data) payload.data = data;
      if (style) payload.style = style;
      if (geometry) payload.geometry = geometry;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.patch(
        `${this.baseUrl}/boards/${boardId}/sticky_notes/${itemId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Delete a specific sticky note
  async deleteSticky(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/boards/${boardId}/sticky_notes/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, status: response.status };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Share a board and invite members
  async shareBoard(boardId: string, params: { emails: string[], role: string, message?: string }): Promise<any> {
    try {
      const payload = {
        emails: params.emails,
        role: params.role,
        message: params.message
      };
      const response = await axios.post(
        `${this.baseUrl}/boards/${boardId}/members`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Create a new card item
  async createCard(boardId: string, data: any, position: { x: number, y: number }, geometry?: { height: number, width: number }, style?: any, parentId?: string): Promise<any> {
    try {
      const payload: any = { data, position };
      if (geometry) payload.geometry = geometry;
      if (style) payload.style = style;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.post(
        `${this.baseUrl}/boards/${boardId}/cards`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Get a specific card item
  async getCard(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/boards/${boardId}/cards/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Update a specific card item
  async updateCard(boardId: string, itemId: string, data?: any, style?: any, geometry?: { height: number, width: number }, parentId?: string): Promise<any> {
    try {
      const payload: any = {};
      if (data) payload.data = data;
      if (style) payload.style = style;
      if (geometry) payload.geometry = geometry;
      if (parentId) payload.parent = { id: parentId };
      const response = await axios.patch(
        `${this.baseUrl}/boards/${boardId}/cards/${itemId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Delete a specific card item
  async deleteCard(boardId: string, itemId: string): Promise<any> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/boards/${boardId}/cards/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, status: response.status };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Miro API error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Helper method to make paginated requests for any endpoint
  async makePaginatedRequest(endpoint: string): Promise<any> {
    return this.makeRequest(endpoint, true);
  }

  // Calculate coordinates for child widgets relative to their parent frame
  async calculateChildrenCoordinates(boardId: string, frameId: string, childWidgetId: string): Promise<{ x: number, y: number }> {
    try {
      // Get the frame details
      const frame = await this.getFrame(boardId, frameId);

      // Get the child widget details
      let childWidget;
      try {
        // Try to get as different item types
        childWidget = await this.getSticky(boardId, childWidgetId);
      } catch {
        try {
          childWidget = await this.getTextItem(boardId, childWidgetId);
        } catch {
          try {
            childWidget = await this.getCard(boardId, childWidgetId);
          } catch {
            throw new Error(`Could not find child widget with ID: ${childWidgetId}`);
          }
        }
      }

      // Extract position and geometry data
      const frameX = frame.position?.x || 0;
      const frameY = frame.position?.y || 0;
      const frameWidth = frame.geometry?.width || 0;
      const frameHeight = frame.geometry?.height || 0;

      const childX = childWidget.position?.x || 0;
      const childY = childWidget.position?.y || 0;

      // Calculate the absolute coordinates relative to the frame's center
      const rectCenterX = frameX - frameWidth / 2 + childX;
      const rectCenterY = frameY - frameHeight / 2 + childY;

      return { x: rectCenterX, y: rectCenterY };
    } catch (error) {
      throw new Error(`Failed to calculate children coordinates: ${(error as Error).message}`);
    }
  }

  // Get frame and child widget details for coordinate calculation
  async getFrameAndChildDetails(boardId: string, frameId: string, childWidgetId: string): Promise<{
    frame: any;
    childWidget: any;
    calculatedPosition: { x: number, y: number };
  }> {
    try {
      const frame = await this.getFrame(boardId, frameId);
      let childWidget;

      // Try to get child widget as different types
      try {
        childWidget = await this.getSticky(boardId, childWidgetId);
      } catch {
        try {
          childWidget = await this.getTextItem(boardId, childWidgetId);
        } catch {
          try {
            childWidget = await this.getCard(boardId, childWidgetId);
          } catch {
            throw new Error(`Could not find child widget with ID: ${childWidgetId}`);
          }
        }
      }

      const calculatedPosition = await this.calculateChildrenCoordinates(boardId, frameId, childWidgetId);

      return {
        frame,
        childWidget,
        calculatedPosition
      };
    } catch (error) {
      throw new Error(`Failed to get frame and child details: ${(error as Error).message}`);
    }
  }

  // Calculate positions within frame based on frame dimensions
  calculateFramePositions(frameWidth: number, frameHeight: number): {
    title: { x: number, y: number };
    leftColumn: { x: number, y: number };
    rightColumn: { x: number, y: number };
    fullWidth: { x: number, y: number };
    sectionStart: { x: number, y: number };
  } {
    const padding = 50;
    const usableWidth = frameWidth - (padding * 2);
    const usableHeight = frameHeight - (padding * 2);

    return {
      title: { x: frameWidth / 2, y: padding + 30 },
      leftColumn: { x: padding + (usableWidth / 4), y: padding + 100 },
      rightColumn: { x: padding + (3 * usableWidth / 4), y: padding + 100 },
      fullWidth: { x: frameWidth / 2, y: padding + 100 },
      sectionStart: { x: frameWidth / 2, y: padding + 200 }
    };
  }

  // Get text styles based on type
  getTextStyles(type: 'title' | 'header' | 'body' | 'positive' | 'negative' | 'neutral' = 'body'): {
    fontSize: number;
    textAlign: string;
    color: string;
    fontWeight?: string;
  } {
    const styles = {
      title: { fontSize: 20, textAlign: 'center', color: '#1a1a1a', fontWeight: 'bold' },
      header: { fontSize: 16, textAlign: 'left', color: '#1a1a1a', fontWeight: 'bold' },
      body: { fontSize: 12, textAlign: 'left', color: '#1a1a1a' },
      positive: { fontSize: 12, textAlign: 'left', color: '#16a34a' },
      negative: { fontSize: 12, textAlign: 'left', color: '#dc2626' },
      neutral: { fontSize: 12, textAlign: 'left', color: '#2563eb' }
    };

    return styles[type];
  }

  // Calculate text width based on frame width and content type
  calculateTextWidth(frameWidth: number, type: 'title' | 'fullWidth' | 'twoColumn' | 'body' = 'body'): number {
    const padding = 50;

    switch (type) {
      case 'title':
        return frameWidth - 100;
      case 'fullWidth':
        return frameWidth - 100;
      case 'twoColumn':
        return (frameWidth - 150) / 2;
      case 'body':
      default:
        return frameWidth / 2 - 75;
    }
  }

  // Create text with proper positioning and styling
  async createFrameText(
    boardId: string,
    parentId: string,
    content: string,
    position: { x: number, y: number },
    type: 'title' | 'header' | 'body' | 'positive' | 'negative' | 'neutral' = 'body',
    frameWidth?: number
  ): Promise<any> {
    const style = this.getTextStyles(type);
    const widthType = type === 'title' ? 'title' : 'body';
    const width = frameWidth ? this.calculateTextWidth(frameWidth, widthType) : undefined;

    return this.createText(
      boardId,
      { content },
      position,
      width ? { width } : undefined,
      style,
      parentId
    );
  }

  // Create a complete frame layout with calculated positions
  async createFrameLayout(
    boardId: string,
    frameId: string,
    layout: {
      title?: string;
      leftColumn?: string[];
      rightColumn?: string[];
      fullWidth?: string[];
    }
  ): Promise<any[]> {
    try {
      // Get frame details to calculate positions
      const frame = await this.getFrame(boardId, frameId);
      const frameWidth = frame.geometry?.width || 1400;
      const frameHeight = frame.geometry?.height || 1000;

      const positions = this.calculateFramePositions(frameWidth, frameHeight);
      const createdItems: any[] = [];

      // Create title if provided
      if (layout.title) {
        const titleItem = await this.createFrameText(
          boardId,
          frameId,
          layout.title,
          positions.title,
          'title',
          frameWidth
        );
        createdItems.push(titleItem);
      }

      // Create left column items
      if (layout.leftColumn) {
        for (let i = 0; i < layout.leftColumn.length; i++) {
          const yOffset = positions.leftColumn.y + (i * 80);
          const item = await this.createFrameText(
            boardId,
            frameId,
            layout.leftColumn[i],
            { x: positions.leftColumn.x, y: yOffset },
            'body',
            frameWidth
          );
          createdItems.push(item);
        }
      }

      // Create right column items
      if (layout.rightColumn) {
        for (let i = 0; i < layout.rightColumn.length; i++) {
          const yOffset = positions.rightColumn.y + (i * 80);
          const item = await this.createFrameText(
            boardId,
            frameId,
            layout.rightColumn[i],
            { x: positions.rightColumn.x, y: yOffset },
            'body',
            frameWidth
          );
          createdItems.push(item);
        }
      }

      // Create full width items
      if (layout.fullWidth) {
        for (let i = 0; i < layout.fullWidth.length; i++) {
          const yOffset = positions.fullWidth.y + (i * 80);
          const item = await this.createFrameText(
            boardId,
            frameId,
            layout.fullWidth[i],
            { x: positions.fullWidth.x, y: yOffset },
            'body',
            frameWidth
          );
          createdItems.push(item);
        }
      }

      return createdItems;
    } catch (error) {
      throw new Error(`Failed to create frame layout: ${(error as Error).message}`);
    }
  }
}

// Enhanced template recommendation logic
export class TemplateRecommendationEngine {
  private miroClient: MiroClient;

  constructor(accessToken: string) {
    this.miroClient = new MiroClient(accessToken);
  }

  async analyzeBoard(boardId: string): Promise<{
    content: string[];
    itemTypes: string[];
    boardInfo: MiroBoardInfo;
    keywords: string[];
    categories: string[];
    context: string;
  }> {
    const boardInfo = await this.miroClient.getBoardInfo(boardId);
    const content = await this.miroClient.getBoardContent(boardId);

    // Get unique item types
    const itemTypes = [...new Set(boardInfo.items.map(item => item.type))];

    // Analyze content for keywords and categories
    const analysis = this.analyzeContentForKeywords(content);

    return {
      content,
      itemTypes,
      boardInfo,
      keywords: analysis.keywords,
      categories: analysis.categories,
      context: analysis.context
    };
  }

  private analyzeContentForKeywords(content: string[]): {
    keywords: string[];
    categories: string[];
    context: string;
  } {
    const allText = content.join(" ").toLowerCase();
    const foundKeywords: string[] = [];
    const matchedCategories: string[] = [];

    // Updated template categories to match miro-server.ts
    const templateCategories = {
      "workshops": {
        keywords: [
          "workshop", "facilitation", "meeting", "collaboration", "team building",
          "icebreaker", "session", "attendees", "participants", "discussion",
          "facilitated", "breakout", "group exercise", "team activity"
        ],
        weight: 0.9,
        semanticDescription: "Activities and structures for facilitating group sessions, team building, and collaborative work"
      },
      "brainstorming": {
        keywords: [
          "ideas", "creativity", "innovation", "brainstorm", "ideation", "concepts",
          "mind map", "creative thinking", "generate ideas", "explore options",
          "think outside", "creative session", "idea generation"
        ],
        weight: 1.0,
        semanticDescription: "Tools and frameworks for generating, organizing, and developing creative ideas"
      },
      "research": {
        keywords: [
          "research", "user research", "market research", "customer insights",
          "user experience", "ux", "design research", "user testing",
          "customer journey", "persona", "user feedback"
        ],
        weight: 1.0,
        semanticDescription: "Tools for conducting and organizing user research, market analysis, and design research"
      },
      "strategic_planning": {
        keywords: [
          "strategy", "planning", "roadmap", "business model", "goals",
          "objectives", "vision", "mission", "strategy planning",
          "business planning", "market analysis"
        ],
        weight: 1.0,
        semanticDescription: "Frameworks and tools for strategic business planning and analysis"
      },
      "agile": {
        keywords: [
          "sprint", "scrum", "agile", "retrospective", "standup", "backlog",
          "user stories", "kanban", "velocity", "story points", "sprint planning",
          "daily standup", "sprint review", "burndown", "epic", "feature"
        ],
        weight: 1.2,
        semanticDescription: "Tools and frameworks for agile project management and development"
      },
      "mapping": {
        keywords: [
          "mapping", "diagram", "flowchart", "process", "workflow",
          "swimlane", "stakeholder", "uml", "system", "architecture"
        ],
        weight: 1.0,
        semanticDescription: "Tools for creating various types of diagrams and visual maps"
      }
    };

    // Enhanced matching with weights
    for (const [category, categoryData] of Object.entries(templateCategories)) {
      const matchingKeywords = categoryData.keywords.filter(keyword =>
        allText.includes(keyword.toLowerCase())
      );
      if (matchingKeywords.length > 0) {
        foundKeywords.push(...matchingKeywords);
        // Add category multiple times based on weight for better ranking
        const weightedCount = Math.ceil(matchingKeywords.length * categoryData.weight);
        for (let i = 0; i < weightedCount; i++) {
          matchedCategories.push(category);
        }
      }
    }

    // Generate context description
    const uniqueCategories = [...new Set(matchedCategories)];
    const context = this.generateContextDescription(uniqueCategories);

    return {
      keywords: [...new Set(foundKeywords)],
      categories: uniqueCategories,
      context
    };
  }

  private generateContextDescription(categories: string[]): string {
    const contextMap: { [key: string]: string } = {
      "agile": "Agile/Scrum methodology",
      "design": "Design and UX work",
      "planning": "Strategic planning",
      "brainstorming": "Ideation and creativity",
      "analysis": "Research and analysis",
      "workshops": "Team collaboration and workshops",
      "meetings": "Meeting management and follow-up",
      "research": "Research and user insights",
      "strategic_planning": "Strategic business planning",
      "mapping": "Process mapping and diagramming"
    };
    const contexts = categories.slice(0, 3).map(cat => contextMap[cat]).filter(Boolean);
    return contexts.length > 0
      ? `Content appears to focus on: ${contexts.join(", ")}`
      : "General collaborative work";
  }
}