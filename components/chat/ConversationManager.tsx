'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useToast } from '../../hooks/use-toast';

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationManagerProps {
  children: (
    createNewConversation: () => Promise<void>,
    conversations: Conversation[],
    currentConversationId: string | null,
    setCurrentConversationId: (id: string | null) => void,
    isLoading: boolean
  ) => ReactNode;
}

export function ConversationManager({ children }: ConversationManagerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
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

  return (
    <>
      {children(
        createNewConversation,
        conversations,
        currentConversationId,
        setCurrentConversationId,
        isLoading
      )}
    </>
  );
}
