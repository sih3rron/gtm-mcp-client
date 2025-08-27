export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolCall[];
    createdAt: Date;
  }
  
  export interface ToolCall {
    id?: string;
    name: string;
    arguments?: Record<string, any>;
    result?: any;
    status?: 'pending' | 'success' | 'error';
    error?: string;
  }
  
  export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }