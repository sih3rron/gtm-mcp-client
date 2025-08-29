#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// --- Gong API Helpers ---
const GONG_API_BASE = 'https://us-45594.api.gong.io/v2';
const keys = `${Buffer.from(`${process.env.GONG_KEY}:${process.env.GONG_SECRET}`).toString('base64')}`;
const gongCache = new Map<string, any>();

async function gongGet(endpoint: string, params: any = {}) {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  async function fetchWithRetry(fetchFn: () => Promise<any>): Promise<any> {
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
  }
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
            'Authorization': `Basic ${keys}`,
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
    const result = { calls: allCalls, next: null };
    gongCache.set(cacheKey, result);
    return result;
  }
}

async function gongPost(endpoint: string, data: any) {
  const url = `${GONG_API_BASE}${endpoint}`;
  return axios.post(url, data, {
    headers: {
      'Authorization': `Basic ${keys}`,
      'Content-Type': 'application/json',
    },
  }).then(r => r.data);
}

function fuzzyMatch(callTitle: string, searchTerm: string): boolean {
  const title = callTitle.toLowerCase().trim();
  const term = searchTerm.toLowerCase().trim();
  if (title === term || title.includes(term) || term.includes(title)) {
    return true;
  }
  const searchWords = term.split(/\s+/).filter(word => word.length > 2);
  const titleWords = title.split(/\s+/);
  for (const searchWord of searchWords) {
    for (const titleWord of titleWords) {
      if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        return true;
      }
    }
  }
  const titleNormalized = title.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
  const termNormalized = term.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
  if (titleNormalized.includes(termNormalized)) {
    return true;
  }
  if (term.length >= 3 && title.length >= 3) {
    const similarity = calculateSimilarity(title, term);
    if (similarity > 0.6) {
      return true;
    }
    for (const searchWord of searchWords) {
      for (const titleWord of titleWords) {
        if (searchWord.length >= 3 && titleWord.length >= 3) {
          const wordSimilarity = calculateSimilarity(titleWord, searchWord);
          if (wordSimilarity > 0.75) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function calculateSimilarity(a: string, b: string): number {
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

function flexibleMatch(callTitle: string, searchTerm: string): boolean {
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
      calculateSimilarity(titleWord, searchWord) > 0.8
    )
  );
  if (allWordsFound && termWords.length > 0) {
    return true;
  }
  for (const searchWord of termWords) {
    if (searchWord.length >= 3) {
      for (const titleWord of titleWords) {
        if (titleWord.length >= 3) {
          const sim = calculateSimilarity(titleWord, searchWord);
          if (sim > 0.7) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// --- Gong MCP Server ---
class GongMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: "gong-mcp-server",
      version: "0.1.0",
      capabilities: { tools: {} },
    });
    this.setupToolHandlers();
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_gong_calls",
          description: "Search Gong calls by customer name and date range, returns matching calls for user selection.",
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
          description: "Select a specific call from search results by selection number or direct call ID.",
          inputSchema: {
            type: "object",
            properties: {
              callId: { type: "string", description: "Direct Gong call ID to select" },
              selectionNumber: { type: "number", description: "Selection number from search results (1, 2, 3, etc.)" },
              customerName: { type: "string", description: "Original customer name used in search (required when using selectionNumber)" }
            },
            anyOf: [ { required: ["callId"] }, { required: ["selectionNumber", "customerName"] } ]
          }
        },
        {
          name: "get_gong_call_details",
          description: "Fetch highlights and keypoints for a Gong call by callId.",
          inputSchema: {
            type: "object",
            properties: {
              callId: { type: "string", description: "The Gong call ID" }
            },
            required: ["callId"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "search_gong_calls":
            return await this.searchGongCalls(request.params.arguments);
          case "select_gong_call":
            return await this.selectGongCall(request.params.arguments);
          case "get_gong_call_details":
            return await this.getGongCallDetails(request.params.arguments);
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true
        };
      }
    });
  }

  // --- Gong methods copied from index.ts ---
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
    if (!keys) {
      calls = [
        { id: "call_001", title: "Schipol Airport - Q1 Planning Session", url: "https://app.gong.io/call/call_001", started: "2025-03-23T10:00:00Z", primaryUserId: "user_123", duration: 3600, parties: ["john.doe@company.com", "manager@schipol.nl"] },
        { id: "call_002", title: "Schipol - Infrastructure Review", url: "https://app.gong.io/call/call_002", started: "2025-03-15T14:30:00Z", primaryUserId: "user_456", duration: 2700, parties: ["jane.smith@company.com", "tech@schipol.nl"] },
        { id: "call_003", title: "Weekly Sync - Schipol Team", url: "https://app.gong.io/call/call_003", started: "2025-03-20T09:00:00Z", primaryUserId: "user_789", duration: 1800, parties: ["team@company.com", "project@schipol.nl"] }
      ];
    } else {
      const data = await gongGet('/calls', {
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
      matches = calls.filter(call => flexibleMatch(call.title, customerName))
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
      content: [{
        type: "text",
        text: JSON.stringify({
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
        }, null, 2)
      }]
    };
  }

  private async selectGongCall(args: any) {
    const { callId, selectionNumber, customerName } = args;
    if (selectionNumber && customerName) {
      const searchResult = await this.searchGongCalls({ customerName });
      const searchData = JSON.parse(searchResult.content[0].text);
      const selectedMatch = searchData.matches.find((match: any) =>
        match.selectionNumber === selectionNumber
      );
      if (!selectedMatch) {
        throw new Error(`Selection number ${selectionNumber} not found. Please use a number between 1 and ${searchData.matches.length}.`);
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            selectedCall: {
              callId: selectedMatch.callId,
              title: selectedMatch.title,
              date: selectedMatch.date,
              duration: selectedMatch.duration,
              participants: selectedMatch.participants,
              url: selectedMatch.url
            },
            message: `Selected call: \"${selectedMatch.title}\" from ${selectedMatch.date}`,
            nextSteps: "You can now use 'get_gong_call_details' with this callId to get highlights and key points."
          }, null, 2)
        }]
      };
    }
    if (callId) {
      let callDetails: any;
      if (!keys) {
        callDetails = {
          id: callId,
          title: "Selected Call",
          started: new Date().toISOString(),
          url: `https://app.gong.io/call/${callId}`
        };
      } else {
        try {
          const response = await gongGet(`/calls/${callId}`);
          callDetails = response;
        } catch (error) {
          throw new Error(`Call with ID ${callId} not found or not accessible.`);
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
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
            message: `Selected call: \"${callDetails.title}\"`,
            nextSteps: "You can now use 'get_gong_call_details' with this callId to get highlights and key points."
          }, null, 2)
        }]
      };
    }
    throw new Error("Please provide either a callId or selectionNumber with customerName.");
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

  private async getGongCallDetails(args: any) {
    const { callId } = args;
    let details: any;
    if (!keys) {
      details = {
        callId,
        highlights: ["Key moment 1", "Key moment 2"],
        keyPoints: ["Summary point 1", "Summary point 2"]
      };
    } else {
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
      const data = await gongPost('/calls/extensive', postBody);
      details = data;
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify(details, null, 2)
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Gong MCP server running on stdio");
  }
}

const server = new GongMCPServer();
server.run().catch(console.error); 