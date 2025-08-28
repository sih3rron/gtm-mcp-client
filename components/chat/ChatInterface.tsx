'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Send, Bot, User, Settings, Loader2, ExternalLink } from 'lucide-react';
import { Message, ToolCall } from '../../types/chat';
import { useToast } from '../../hooks/use-toast';

interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: Message[];
  onNewMessage?: (message: Message) => void;
}

export function ChatInterface({ 
  conversationId, 
  initialMessages = [], 
  onNewMessage 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailableTools();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchAvailableTools = async () => {
    try {
      const response = await fetch('/api/mcp/tools');
      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.tools || []);
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationId,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        toolCalls: data.toolCalls,
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (onNewMessage) {
        onNewMessage(userMessage);
        onNewMessage(assistantMessage);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Available Tools Panel */}
      {availableTools.length > 0 && (
        <div className="border-b p-4">
          <h3 className="text-sm font-medium mb-2">Available Tools</h3>
          <div className="flex flex-wrap gap-2">
            {availableTools.map((tool, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tool.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Welcome to MCP Chat</h3>
              <p className="text-sm">
                Start a conversation to analyze Miro boards, get template recommendations, and more!
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Assistant is thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to analyze a Miro board, recommend templates, or create new boards..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        {/* Message Content */}
        <div className="space-y-2">
          <Card className={`p-3 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          </Card>

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2">
              {message.toolCalls.map((toolCall, index) => (
                <ToolCallDisplay key={index} toolCall={toolCall} />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground px-1">
            {message.createdAt.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToolCallDisplayProps {
  toolCall: ToolCall;
}

function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="p-3 bg-blue-50 border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Called: {toolCall.name}
          </span>
          {toolCall.status && (
            <Badge 
              variant={toolCall.status === 'success' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {toolCall.status}
            </Badge>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600"
        >
          {isExpanded ? 'Hide' : 'Show'} Details
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          <Separator />
          
          {toolCall.arguments && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Arguments:</p>
              <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Result:</p>
              <div className="text-xs bg-blue-100 p-2 rounded">
                {typeof toolCall.result === 'string' ? (
                  <span>{toolCall.result}</span>
                ) : (
                  <pre className="overflow-x-auto">
                    {JSON.stringify(toolCall.result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Special handling for template recommendations */}
          {toolCall.name === 'recommend_templates' && toolCall.result && (
            <div className="mt-2">
              <p className="text-xs font-medium text-blue-700 mb-2">Recommended Templates:</p>
              <div className="space-y-2">
                {Array.isArray(toolCall.result.recommendations) && 
                 toolCall.result.recommendations.map((template: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(template.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}