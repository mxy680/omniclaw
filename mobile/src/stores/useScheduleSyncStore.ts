import { create } from 'zustand';
import { loadScheduleSync, saveScheduleSync } from '../lib/persistence';

const MAX_INJECTED_IDS = 500;

interface ScheduleSyncState {
  lastSyncTimestamp: string | null;
  injectedRunIds: Set<string>;
  unreadCounts: Record<string, number>;
  activeAgentIds: string[];
  isLoaded: boolean;

  load: () => Promise<void>;
  markRunInjected: (runId: string) => void;
  updateLastSync: (timestamp: string) => void;
  incrementUnread: (conversationId: string) => void;
  markRead: (conversationId: string) => void;
  totalUnread: () => number;
  setActiveAgents: (ids: string[]) => void;
}

export const useScheduleSyncStore = create<ScheduleSyncState>((set, get) => ({
  lastSyncTimestamp: null,
  injectedRunIds: new Set(),
  unreadCounts: {},
  activeAgentIds: [],
  isLoaded: false,

  load: async () => {
    const data = await loadScheduleSync();
    // Cap injected IDs to prevent unbounded growth
    const ids = data.injectedRunIds.slice(-MAX_INJECTED_IDS);
    set({
      lastSyncTimestamp: data.lastSyncTimestamp,
      injectedRunIds: new Set(ids),
      unreadCounts: data.unreadCounts,
      isLoaded: true,
    });
  },

  markRunInjected: (runId) => {
    set((state) => {
      const updated = new Set(state.injectedRunIds);
      updated.add(runId);
      // Prune if too large
      if (updated.size > MAX_INJECTED_IDS) {
        const arr = Array.from(updated);
        const pruned = new Set(arr.slice(arr.length - MAX_INJECTED_IDS));
        persist(get);
        return { injectedRunIds: pruned };
      }
      persist(get);
      return { injectedRunIds: updated };
    });
  },

  updateLastSync: (timestamp) => {
    set({ lastSyncTimestamp: timestamp });
    persist(get);
  },

  incrementUnread: (conversationId) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [conversationId]: (state.unreadCounts[conversationId] ?? 0) + 1,
      },
    }));
    persist(get);
  },

  markRead: (conversationId) => {
    const current = get().unreadCounts[conversationId];
    if (!current) return;
    set((state) => {
      const updated = { ...state.unreadCounts };
      delete updated[conversationId];
      return { unreadCounts: updated };
    });
    persist(get);
  },

  totalUnread: () => {
    return Object.values(get().unreadCounts).reduce((sum, n) => sum + n, 0);
  },

  setActiveAgents: (ids) => {
    set({ activeAgentIds: ids });
  },
}));

function persist(get: () => ScheduleSyncState) {
  const { lastSyncTimestamp, injectedRunIds, unreadCounts } = get();
  saveScheduleSync({
    lastSyncTimestamp,
    injectedRunIds: Array.from(injectedRunIds),
    unreadCounts,
  });
}
