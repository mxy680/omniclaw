import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { ScheduleRunRow } from '@/components/ScheduleRunRow';
import * as ScheduleService from '@/services/ScheduleService';
import { ScheduleRun } from '@/types/schedule';

export default function ScheduleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const { host, mcpPort, mcpToken } = useSettingsStore();
  const { agent } = useAgentStore();
  const { jobs, triggerJob } = useScheduleStore();

  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const job = jobs.find(j => j.id === id);
  const agentData = job ? agent(job.agentId) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: job?.name ?? 'Schedule',
    });
  }, [navigation, job?.name]);

  const loadRuns = useCallback(async () => {
    if (!id || !host) return;
    setRunsLoading(true);
    try {
      const fetched = await ScheduleService.fetchRuns(id, host, mcpPort, mcpToken);
      setRuns(fetched);
    } finally {
      setRunsLoading(false);
    }
  }, [id, host, mcpPort, mcpToken]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function handleTrigger() {
    if (!id) return;
    setTriggering(true);
    try {
      const success = await triggerJob(id, host, mcpPort, mcpToken);
      if (success) {
        // Reload runs after a brief moment
        setTimeout(() => loadRuns(), 1000);
      } else {
        Alert.alert('Error', 'Failed to trigger the schedule job.');
      }
    } finally {
      setTriggering(false);
    }
  }

  function formatNextRun(): string {
    if (!job?.nextRun) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(job.nextRun), { addSuffix: true });
    } catch {
      return job.nextRun;
    }
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>Schedule Not Found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={runsLoading} onRefresh={loadRuns} />
      }
    >
      {/* Details section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>DETAILS</Text>
      </View>
      <View style={styles.card}>
        <DetailRow label="Agent" value={agentData?.name ?? job.agentId} />
        <View style={styles.cardDivider} />
        <DetailRow label="Schedule" value={job.cron} mono />
        <View style={styles.cardDivider} />
        <DetailRow label="Timezone" value={job.timezone ?? 'UTC'} />
        <View style={styles.cardDivider} />
        <DetailRow label="Instruction File" value={job.instructionFile} mono />
        <View style={styles.cardDivider} />
        <DetailRow
          label="Status"
          value={job.enabled ? 'Enabled' : 'Disabled'}
          valueStyle={job.enabled ? styles.enabledText : styles.disabledText}
        />
        {job.nextRun && (
          <>
            <View style={styles.cardDivider} />
            <DetailRow label="Next Run" value={formatNextRun()} />
          </>
        )}
      </View>

      {/* Description section */}
      {job.description ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.descriptionText}>{job.description}</Text>
          </View>
        </>
      ) : null}

      {/* Run Now button */}
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.runButton, triggering && styles.runButtonDisabled]}
          onPress={handleTrigger}
          disabled={triggering}
        >
          {triggering ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.runButtonText}>Run Now</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Recent Runs section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>RECENT RUNS</Text>
      </View>

      {runsLoading && runs.length === 0 ? (
        <View style={styles.runsLoading}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : runs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyRuns}>No runs yet</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {runs.map((run, index) => (
            <View key={run.id}>
              <ScheduleRunRow
                run={run}
                onPress={() =>
                  router.push({
                    pathname: '/schedule/run/[runId]',
                    params: { runId: run.id },
                  })
                }
              />
              {index < runs.length - 1 && <View style={styles.cardDivider} />}
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  valueStyle?: object;
}

function DetailRow({ label, value, mono, valueStyle }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, mono && styles.monoValue, valueStyle]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  detailLabel: {
    fontSize: 15,
    color: '#000000',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'right',
    flex: 1,
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  enabledText: {
    color: '#34C759',
  },
  disabledText: {
    color: '#FF3B30',
  },
  descriptionText: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
    padding: 16,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  runsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyRuns: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  bottomSpacer: {
    height: 32,
  },
});
