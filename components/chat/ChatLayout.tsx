'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { ChatInterface } from './ChatInterface';
import { ConversationList } from './ConversationList';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  LogOut, 
  Menu,
  Sidebar,
  X
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import type { User } from 'next-auth';

interface ChatLayoutProps {
  user: User;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export function ChatLayout({ user }: ChatLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        
        // Select the most recent conversation if available
        if (data.conversations?.length > 0 && !currentConversationId) {
          setCurrentConversationId(data.conversations[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Conversation',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newConversation = {
          ...data.conversation,
          createdAt: new Date(data.conversation.createdAt),
          updatedAt: new Date(data.conversation.updatedAt),
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
        
        toast({
          title: 'Success',
          description: 'New conversation created',
        });
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new conversation',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/auth/signin' });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`flex flex-col border-r bg-muted/50 transition-all duration-300 ${
        sidebarOpen ? 'w-80' : 'w-0'
      } ${sidebarOpen ? '' : 'overflow-hidden'}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-semibold">MCP Chat</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* New Conversation Button */}
        <div className="p-4">
          <Button onClick={createNewConversation} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2">
            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onConversationSelect={setCurrentConversationId}
              isLoading={isLoading}
            />
          </ScrollArea>
        </div>

        {/* User Menu */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-2">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={user.image || undefined} />
                  <AvatarFallback>
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left truncate">
                  <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem disabled>
                <Settings className="h-4 w-4 mr-2" />
                Settings (Coming Soon)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="font-semibold">
                {currentConversation?.title || 'MCP Chat'}
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-powered Miro board analysis and collaboration
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden"
              >
                <Sidebar className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1">
          <ChatInterface
            conversationId={currentConversationId || undefined}
            onNewMessage={(message) => {
              // Update conversation list if needed
              if (currentConversationId) {
                setConversations(prev =>
                  prev.map(conv =>
                    conv.id === currentConversationId
                      ? { ...conv, updatedAt: new Date() }
                      : conv
                  )
                );
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}