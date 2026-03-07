import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { format } from 'date-fns';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import * as ScheduleService from '@/services/ScheduleService';
import { ScheduleRun, RunStatus, durationFormatted } from '@/types/schedule';

export default function ScheduleRunScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const navigation = useNavigation();

  const { host, mcpPort, mcpToken } = useSettingsStore();
  const { agent } = useAgentStore();
  const { jobs } = useScheduleStore();

  const [run, setRun] = useState<ScheduleRun | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Run Result' });
  }, [navigation]);

  useEffect(() => {
    async function loadRun() {
      if (!runId) return;
      // Find which job this run belongs to by fetching runs for each job
      // We need to search through jobs to find the matching run
      for (const job of jobs) {
        try {
          const runs = await ScheduleService.fetchRuns(job.id, host, mcpPort, mcpToken, 50);
          const found = runs.find(r => r.id === runId);
          if (found) {
            setRun(found);
            break;
          }
        } catch {
          // Continue searching other jobs
        }
      }
      setLoading(false);
    }
    loadRun();
  }, [runId, jobs, host, mcpPort, mcpToken]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Run not found</Text>
      </View>
    );
  }

  const agentData = agent(run.agentId);
  const duration = durationFormatted(run.durationMs);

  function formatDate(dateStr: string): string {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {/* Status badge + duration */}
      <View style={styles.statusRow}>
        <StatusBadge status={run.status} />
        {duration && <Text style={styles.durationText}>{duration}</Text>}
      </View>

      {/* Metadata card */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>METADATA</Text>
      </View>
      <View style={styles.card}>
        <MetaRow label="Agent" value={agentData?.name ?? run.agentId} />
        <View style={styles.cardDivider} />
        <MetaRow label="Started" value={formatDate(run.startedAt)} />
        {run.completedAt && (
          <>
            <View style={styles.cardDivider} />
            <MetaRow label="Completed" value={formatDate(run.completedAt)} />
          </>
        )}
      </View>

      <View style={styles.fullDivider} />

      {/* Instruction section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>INSTRUCTION</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.codeText}>{run.instruction}</Text>
      </View>

      {/* Response section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>RESPONSE</Text>
      </View>
      <View style={styles.textBox}>
        <Text style={styles.codeText}>{run.response || '(no response)'}</Text>
      </View>

      {/* Error section */}
      {run.errorMessage ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ERROR</Text>
          </View>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{run.errorMessage}</Text>
          </View>
        </>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

interface StatusBadgeProps {
  status: RunStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    completed: { label: 'Completed', backgroundColor: '#D1FAE5', textColor: '#065F46' },
    error: { label: 'Error', backgroundColor: '#FEE2E2', textColor: '#991B1B' },
    running: { label: 'Running', backgroundColor: '#FEF3C7', textColor: '#92400E' },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: config.textColor }]}>{config.label}</Text>
    </View>
  );
}

interface MetaRowProps {
  label: string;
  value: string;
}

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingTop: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  notFoundText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6D6D72',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 16,
  },
  fullDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  metaLabel: {
    fontSize: 15,
    color: '#000000',
    flexShrink: 0,
  },
  metaValue: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'right',
    flex: 1,
  },
  textBox: {
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
  },
  codeText: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  errorBox: {
    backgroundColor: '#FFF0F0',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB3B3',
  },
  errorText: {
    fontSize: 14,
    color: '#CC3333',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
