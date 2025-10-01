import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { conversations, messages } from '../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk'
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const anthropic = new AnthropicBedrock({
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1'
});


interface MCPTool {
  name: string;
  description: string;
  input_schema: any;
}

// Add this function to fetch MCP resources
async function fetchMCPResources() {
  try {
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/resources`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
    });
    if (!response.ok) {
      console.warn('Failed to fetch MCP resources:', response.statusText);
      return [];
    }
    const data = await response.json();
    return data.resources || [];
  } catch (error) {
    console.warn('Error fetching MCP resources:', error);
    return [];
  }
}

// Add this function to fetch specific resource content
async function fetchMCPResource(uri: string) {
  try {
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/resources${uri}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch MCP resource ${uri}:`, response.statusText);
      return null;
    }
    const data = await response.json();
    return data.contents?.[0] || null;
  } catch (error) {
    console.warn(`Error fetching MCP resource ${uri}:`, error);
    return null;
  }
}

// Fetch available tools from MCP service
async function fetchMCPTools(): Promise<MCPTool[]> {
  console.log('=== fetchMCPTools FUNCTION CALLED ===');
  try {
    console.log('Fetching MCP tools from:', process.env.MIRO_MCP_SERVICE_URL);
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/tools`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
    });
    console.log('MCP tools response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MCP tools response error:', errorText);
      throw new Error(`Failed to fetch MCP tools: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('MCP tools data received:', data);

    // Convert MCP tools to Anthropic format
    return data.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  } catch (error) {
    console.error('Error fetching MCP tools:', error);
    return [];
  }
}

// Call MCP service tool
async function callMCPTool(name: string, args: any) {
  try {
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
      body: JSON.stringify({ name, arguments: args }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Tool execution failed');
    }

    return await response.json();
  } catch (error) {
    console.error(`Error calling MCP tool ${name}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('=== CHAT API CALLED ===');
  try {
    const session = await auth();
    console.log('Session check:', !!session?.user);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId, history = [] } = await request.json();
    console.log('Message received:', message?.substring(0, 50));

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ADD THIS: Fetch available MCP resources
    const resources = await fetchMCPResources();
    console.log('📚 Available MCP resources:', resources.length);

    // ADD THIS: Fetch framework resources content for context
    let frameworkContext = '';
    if (resources.length > 0) {
      const frameworkResources = resources.filter((r: any) => r.uri.includes('/frameworks/'));

      for (const resource of frameworkResources.slice(0, 4)) { // Limit to avoid token overflow
        const content = await fetchMCPResource(resource.uri);
        if (content) {
          frameworkContext += `\n\n## ${resource.name}\n${content.text.substring(0, 2000)}...`; // Truncate to avoid token limits
        }
      }
    }

    // Fetch available MCP tools
    console.log('About to fetch MCP tools...');
    const mcpTools = await fetchMCPTools();
    console.log('MCP tools fetched, count:', mcpTools.length);

    // Prepare conversation history for Anthropic
    const anthropicMessages = history.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add the new user message
    anthropicMessages.push({
      role: 'user',
      content: message,
    });

    // Call Anthropic with MCP tools
    console.log('About to call Anthropic API with tools:', mcpTools.length);
    console.log('Anthropic messages count:', anthropicMessages.length);
    console.log('MCP tools structure:', JSON.stringify(mcpTools, null, 2));

    let response;
    try {
      const model = process.env.ANTHROPIC_MODEL;
      if (!model) {
        throw new Error('Anthropic model is not defined in environment variables.');
      }

      const systemMessage = `You are an AI assistant that helps users with Miro board analysis, template recommendations, board creation, and Gong call analysis. You have access to the following MCP tools:

${mcpTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

When users ask about:
- Analyzing Miro boards: Use analyze_board_content with the board ID
- Template recommendations: Use recommend_templates with board ID or meeting notes  
- Creating new boards: Use create_miro_board with name and description
- Analyzing Gong calls: Use the framework analysis tools for structured evaluation

IMPORTANT: When presenting results that include URLs (such as Gong calls, Miro templates, or board links), ALWAYS include the URLs in your response text. Format them as clickable markdown links like [Call Title](URL) or [Template Name](URL).

For Gong calls, always include the call URL in the format: [Call Title](call_url)
For Miro templates, always include the template URL in the format: [Template Name](template_url)
For Miro boards, always include the board URL in the format: [Board Name](board_url)

## Available Framework Resources
${resources.length > 0 ? `You have access to detailed framework methodology guides:
${resources.map((r: any) => `- ${r.name} (${r.uri})`).join('\n')}

When performing framework analysis, reference these methodology guides for:
- Understanding framework principles and components
- Providing practical application guidance  
- Offering coaching recommendations based on best practices
- Explaining scoring rationale with framework context
` : 'No framework resources currently available.'}

## Framework Analysis Context
${frameworkContext || 'Framework methodology context will be loaded when analyzing calls.'}

When analyzing calls with frameworks:
1. Reference the methodology guides for comprehensive understanding
2. Use framework principles to explain scoring decisions
3. Provide coaching recommendations based on practical guidance
4. Connect analysis results to business outcomes and framework objectives

Always be helpful and explain what tools you're using and why. When you get results from tools, present them in a user-friendly way with proper source attribution and links.`;
      
      response = await anthropic.messages.create({
        model: model as string, // Ensure type is string and not undefined
        max_tokens: 2000,
        messages: anthropicMessages,
        tools: mcpTools,
        system: systemMessage
      });

      console.log('Anthropic API call successful, response received');
    } catch (error) {
      console.error('Anthropic API call failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        tools: mcpTools,
        messages: anthropicMessages
      });
      throw error;
    }

    let finalResponse = '';
    const toolCalls: any[] = [];
    const citations: any[] = [];

    // Process response content
    for (const content of response.content) {
      if (content.type === 'text') {
        finalResponse += content.text;
      } else if (content.type === 'tool_use') {
        // Execute the tool call via MCP service
        try {
          const toolResult = await callMCPTool(content.name, content.input);

          // Collect citations from web search results
          if (toolResult.citations && Array.isArray(toolResult.citations)) {
            citations.push(...toolResult.citations);
          }

          toolCalls.push({
            id: content.id,
            name: content.name,
            arguments: content.input,
            result: toolResult,
            status: 'success',
          });

          // Get follow-up response from Anthropic with tool results
          const followUpMessages = [
            ...anthropicMessages,
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: content.id,
                  name: content.name,
                  input: content.input,
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: content.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            },
          ];

          // Add a reminder about including URLs and citations in the follow-up prompt
          if (toolResult.matches || toolResult.recommendations || toolResult.url || toolResult.citations) {
            followUpMessages.push({
              role: 'user',
              content: 'Remember to include all URLs and links in your response text. Format them as clickable markdown links like [Title](URL). If there are citations from web search results, make sure to reference them properly.',
            });
          }
          // Ensure the model is defined and of the correct type for Anthropic API
          if (!process.env.ANTHROPIC_MODEL) {
            throw new Error('Anthropic model is not defined in environment variables.');
          }

          const followUpResponse = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL as string, // Type assertion to satisfy the API
            max_tokens: 2000,
            messages: followUpMessages,
          });

          // Add the follow-up response
          if (followUpResponse.content[0].type === 'text') {
            finalResponse += '\n\n' + followUpResponse.content[0].text;
          }

        } catch (error) {
          console.error(`Tool execution failed for ${content.name}:`, error);
          toolCalls.push({
            id: content.id,
            name: content.name,
            arguments: content.input,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          finalResponse += `\n\nI encountered an error while trying to use the ${content.name} tool: ${error instanceof Error ? error.message : 'Unknown error'
            }. Please try again or rephrase your request.`;
        }
      }
    }

    // Save conversation if conversationId is provided
    if (conversationId) {
      try {
        // Save user message
        await db.insert(messages).values({
          conversationId,
          role: 'user',
          content: message,
        });

        // Save assistant message
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: finalResponse,
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
        });

        // Update conversation timestamp
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));

      } catch (dbError) {
        console.error('Error saving conversation:', dbError);
        // Continue anyway - don't fail the request due to DB issues
      }
    }

    return NextResponse.json({
      response: finalResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      citations: citations.length > 0 ? citations : undefined,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}