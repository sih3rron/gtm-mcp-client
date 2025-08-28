'use client';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../ui/dropdown-menu';
import { ChatInterface } from './ChatInterface';
import { ConversationList } from './ConversationList';
import { 
  MessageSquare, 
  Plus, 
  Settings
} from 'lucide-react';
import type { User } from 'next-auth';
import { SignOutButton } from './SignOutButton';

interface ChatLayoutProps {
  user: User;
}

export function ChatLayout({ user }: ChatLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="flex flex-col border-r bg-muted/50 w-80">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-semibold">MCP Chat</span>
          </div>
        </div>

        {/* New Conversation Button */}
        <div className="p-4">
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2">
            <ConversationList
              conversations={[]}
              currentConversationId={null}
              onConversationSelect={() => {}}
              isLoading={false}
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
              <DropdownMenuItem asChild>
                <SignOutButton />
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
            <span className="text-lg font-semibold">Chat</span>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
