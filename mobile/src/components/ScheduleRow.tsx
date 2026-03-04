import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ScheduleJob } from '../types/schedule';
import { agentColor } from '../lib/colors';

interface Props {
  job: ScheduleJob;
  agentName: string;
  agentColorName: string;
  onPress: () => void;
}

export function ScheduleRow({ job, agentName, agentColorName, onPress }: Props) {
  const color = agentColor(agentColorName);

  function nextRunLabel(): string | null {
    if (!job.nextRun) return null;
    try {
      return `Next: ${formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}`;
    } catch {
      return null;
    }
  }

  const nextLabel = nextRunLabel();

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Left: clock circle */}
      <View style={[styles.iconCircle, { backgroundColor: color }]}>
        <Ionicons name="time" size={22} color="#FFFFFF" />
      </View>

      {/* Middle: job name, agent + cron, next run */}
      <View style={styles.textContainer}>
        <Text style={styles.jobName} numberOfLines={1}>{job.name}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {agentName} · {job.cron}
        </Text>
        {nextLabel && (
          <Text style={styles.nextRun} numberOfLines={1}>{nextLabel}</Text>
        )}
      </View>

      {/* Right: disabled badge or running spinner */}
      <View style={styles.rightContainer}>
        {job.isRunning ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : !job.enabled ? (
          <View style={styles.disabledBadge}>
            <Text style={styles.disabledText}>Disabled</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  jobName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  nextRun: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  disabledBadge: {
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
  },
  disabledText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 2,
  },
});
