import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ScheduleRun, RunStatus, durationFormatted } from '../types/schedule';

interface Props {
  run: ScheduleRun;
  onPress: () => void;
}

function statusIcon(status: RunStatus): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (status) {
    case 'completed':
      return { name: 'checkmark-circle', color: '#34C759' };
    case 'error':
      return { name: 'close-circle', color: '#FF3B30' };
    case 'running':
      return { name: 'hourglass', color: '#FF9500' };
  }
}

export function ScheduleRunRow({ run, onPress }: Props) {
  const icon = statusIcon(run.status);
  const duration = durationFormatted(run.durationMs);

  function formatRunDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return format(date, 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Status icon */}
      <Ionicons name={icon.name} size={22} color={icon.color} />

      {/* Date and time */}
      <View style={styles.textContainer}>
        <Text style={styles.dateText}>{formatRunDate(run.startedAt)}</Text>
      </View>

      {/* Duration on the right */}
      <View style={styles.rightContainer}>
        {duration && (
          <Text style={styles.durationText}>{duration}</Text>
        )}
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 15,
    color: '#000000',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
