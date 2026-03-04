import { create } from 'zustand';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Agent } from '../types/agent';
import { loadConversations, saveConversations } from '../lib/persistence';
import * as Crypto from 'expo-crypto';

interface ConversationState {
  conversations: Conversation[];
  load: () => Promise<void>;
  save: () => Promise<void>;
  addMessage: (msg: Message, conversationId: string) => void;
  updateLastMessage: (conversationId: string, content: string, isStreaming: boolean) => void;
  clearConversation: (conversationId: string) => void;
  ensureDefaultConversations: (agents: Agent[]) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],

  load: async () => {
    const data = await loadConversations<Conversation>();
    set({ conversations: data });
  },

  save: async () => {
    await saveConversations(get().conversations);
  },

  addMessage: (msg, conversationId) => {
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, msg], updatedAt: new Date().toISOString() }
          : c
      ),
    }));
    get().save();
  },

  updateLastMessage: (conversationId, content, isStreaming) => {
    set(state => ({
      conversations: state.conversations.map(c => {
        if (c.id !== conversationId || c.messages.length === 0) return c;
        const messages = [...c.messages];
        const last = { ...messages[messages.length - 1], content, isStreaming };
        messages[messages.length - 1] = last;
        return { ...c, messages, updatedAt: new Date().toISOString() };
      }),
    }));
    if (!isStreaming) get().save();
  },

  clearConversation: (conversationId) => {
    set(state => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId
          ? { ...c, messages: [], sessionSuffix: Crypto.randomUUID(), updatedAt: new Date().toISOString() }
          : c
      ),
    }));
    get().save();
  },

  ensureDefaultConversations: (agents) => {
    const { conversations } = get();
    let changed = false;
    const updated = [...conversations];
    for (const agent of agents) {
      if (!updated.some(c => c.agentId === agent.id)) {
        updated.push({
          id: Crypto.randomUUID(),
          agentId: agent.id,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionSuffix: Crypto.randomUUID(),
        });
        changed = true;
      }
    }
    if (changed) {
      set({ conversations: updated });
      get().save();
    }
  },
}));
