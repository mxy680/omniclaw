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

  // Read isLoaded reactively so the effect triggers when it becomes true
  const syncIsLoaded = useScheduleSyncStore((s) => s.isLoaded);

  const poll = useCallback(async () => {
    if (!host || !settingsLoaded) return;

    // Read latest state directly to avoid stale closures and effect re-triggers
    const syncState = useScheduleSyncStore.getState();
    if (!syncState.isLoaded) return;

    const conversations = useConversationStore.getState().conversations;
    const addMessage = useConversationStore.getState().addMessage;

    try {
      const runs = await fetchRecentRuns(
        host, mcpPort, mcpToken,
        syncState.lastSyncTimestamp ?? undefined,
      );

      let newestTimestamp = syncState.lastSyncTimestamp;

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

        // Re-read injectedRunIds each iteration (may have been updated)
        if (useScheduleSyncStore.getState().injectedRunIds.has(run.id)) continue;
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
        syncState.markRunInjected(run.id);
        syncState.incrementUnread(conversation.id);

        const ts = run.completedAt ?? run.startedAt;
        if (!newestTimestamp || ts > newestTimestamp) {
          newestTimestamp = ts;
        }
      }

      // Update active agents for typing indicator
      syncState.setActiveAgents(runningAgentIds);

      if (newestTimestamp && newestTimestamp !== syncState.lastSyncTimestamp) {
        syncState.updateLastSync(newestTimestamp);
      }
    } catch (err) {
      // Silent — will retry next poll
      console.warn('[schedule-sync] poll failed:', err);
    }
  }, [host, mcpPort, mcpToken, settingsLoaded]);

  // Load sync state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    useScheduleSyncStore.getState().load();
  }, []);

  // Start/stop polling interval
  useEffect(() => {
    if (!syncIsLoaded) return;

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, syncIsLoaded]);

  // Poll when app returns to foreground
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') poll();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [poll]);
}
