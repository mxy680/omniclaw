import { useRef, useState, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ChatService, ServerConfig } from '../services/ChatService';
import { useConversationStore } from '../stores/useConversationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Message } from '../types/message';
import { Attachment } from '../types/attachment';
import { sessionKey } from '../types/conversation';

export function useChat(conversationId: string, _agentId: string) {
  const chatServiceRef = useRef<ChatService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConnected, setHasConnected] = useState(false);

  const { addMessage, updateLastMessage, clearConversation, conversations } =
    useConversationStore();
  const { host, port, authToken } = useSettingsStore();

  const syncState = useCallback(() => {
    const svc = chatServiceRef.current;
    if (!svc) return;
    setIsConnected(svc.isConnected);
    setIsStreaming(svc.isStreaming);
  }, []);

  const getOrCreateService = useCallback((): ChatService => {
    if (!chatServiceRef.current) {
      chatServiceRef.current = new ChatService(syncState);
    }
    return chatServiceRef.current;
  }, [syncState]);

  const connect = useCallback(async () => {
    const svc = getOrCreateService();
    const config: ServerConfig = { host, port, authToken };
    try {
      await svc.connect(config);
      setIsConnected(true);
      setHasConnected(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      setIsConnected(false);
    }
  }, [getOrCreateService, host, port, authToken]);

  const disconnect = useCallback(() => {
    chatServiceRef.current?.disconnect();
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      const svc = chatServiceRef.current;
      if (!svc || !svc.isConnected) {
        setError('Not connected to server');
        return;
      }

      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) {
        setError('Conversation not found');
        return;
      }

      const key = sessionKey(conversation);

      // 1. Add user message
      const userMessage: Message = {
        id: Crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        isStreaming: false,
        attachments,
      };
      addMessage(userMessage, conversationId);

      // 2. Add empty assistant placeholder
      const assistantMessage: Message = {
        id: Crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        attachments: [],
      };
      addMessage(assistantMessage, conversationId);

      setIsStreaming(true);
      setError(null);

      svc.sendMessage(text, key, {
        onDelta: (fullText) => {
          updateLastMessage(conversationId, fullText, true);
        },
        onComplete: () => {
          // Mark the last message as no longer streaming, preserving its content
          const conv = useConversationStore.getState().conversations.find(
            c => c.id === conversationId
          );
          const lastContent = conv?.messages.at(-1)?.content ?? '';
          updateLastMessage(conversationId, lastContent, false);
          setIsStreaming(false);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Streaming error';
          setError(msg);
          // Mark the assistant placeholder as non-streaming (preserves whatever content arrived)
          const conv = useConversationStore.getState().conversations.find(
            c => c.id === conversationId
          );
          const lastContent = conv?.messages.at(-1)?.content ?? '';
          updateLastMessage(conversationId, lastContent, false);
          setIsStreaming(false);
        },
      });
    },
    [conversationId, conversations, addMessage, updateLastMessage]
  );

  const abort = useCallback(() => {
    chatServiceRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clear = useCallback(() => {
    clearConversation(conversationId);
  }, [clearConversation, conversationId]);

  // Auto-reconnect when app comes to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && hasConnected && !chatServiceRef.current?.isConnected) {
        connect();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [hasConnected, connect]);

  return {
    isConnected,
    isStreaming,
    error,
    hasConnected,
    connect,
    disconnect,
    sendMessage,
    abort,
    clearError,
    clear,
  };
}
