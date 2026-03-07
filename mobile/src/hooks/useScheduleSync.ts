import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useConversationStore } from '../stores/useConversationStore';
import { useScheduleSyncStore } from '../stores/useScheduleSyncStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Message } from '../types/message';
import { fetchRecentRuns } from '../services/ScheduleService';

const POLL_INTERVAL_MS = 30_000;

export function useScheduleSync() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  const { host, mcpPort, mcpToken, isLoaded: settingsLoaded } = useSettingsStore();
  const conversations = useConversationStore((s) => s.conversations);
  const addMessage = useConversationStore((s) => s.addMessage);

  const syncStore = useScheduleSyncStore();

  const poll = useCallback(async () => {
    if (!host || !settingsLoaded || !syncStore.isLoaded) return;

    try {
      const runs = await fetchRecentRuns(
        host, mcpPort, mcpToken,
        syncStore.lastSyncTimestamp ?? undefined,
      );

      let newestTimestamp = syncStore.lastSyncTimestamp;

      // Track which agents currently have running jobs
      const runningAgentIds: string[] = [];

      for (const run of runs) {
        // Track running jobs for typing indicator
        if (run.status === 'running') {
          if (!runningAgentIds.includes(run.agentId)) {
            runningAgentIds.push(run.agentId);
          }
          continue;
        }

        if (syncStore.injectedRunIds.has(run.id)) continue;
        if (run.status !== 'completed' && run.status !== 'error') continue;

        // Find conversation for this agent
        const conversation = conversations.find((c) => c.agentId === run.agentId);
        if (!conversation) continue;

        const jobName = run.jobName ?? run.jobId;
        const content = run.status === 'error'
          ? `${jobName} failed`
          : jobName;

        const msg: Message = {
          id: Crypto.randomUUID(),
          role: 'assistant',
          content,
          timestamp: run.completedAt ?? run.startedAt,
          isStreaming: false,
          attachments: [],
          metadata: {
            source: 'schedule',
            runId: run.id,
            jobId: run.jobId,
            jobName,
            response: run.status === 'error'
              ? (run.errorMessage ?? 'Unknown error')
              : run.response,
          },
        };

        addMessage(msg, conversation.id);
        syncStore.markRunInjected(run.id);
        syncStore.incrementUnread(conversation.id);

        const ts = run.completedAt ?? run.startedAt;
        if (!newestTimestamp || ts > newestTimestamp) {
          newestTimestamp = ts;
        }
      }

      // Update active agents for typing indicator
      syncStore.setActiveAgents(runningAgentIds);

      if (newestTimestamp && newestTimestamp !== syncStore.lastSyncTimestamp) {
        syncStore.updateLastSync(newestTimestamp);
      }
    } catch (err) {
      // Silent — will retry next poll
      console.warn('[schedule-sync] poll failed:', err);
    }
  }, [host, mcpPort, mcpToken, settingsLoaded, syncStore, conversations, addMessage]);

  // Load sync state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    syncStore.load();
  }, [syncStore]);

  // Start/stop polling interval
  useEffect(() => {
    if (!syncStore.isLoaded) return;

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, syncStore.isLoaded]);

  // Poll when app returns to foreground
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') poll();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [poll]);
}
