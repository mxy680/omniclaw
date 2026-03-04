import { useCallback, useEffect, useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { ScheduleRow } from '@/components/ScheduleRow';
import { ScheduleJob } from '@/types/schedule';

export default function ScheduleListScreen() {
  const navigation = useNavigation();

  const { host, mcpPort, authToken, isLoaded } = useSettingsStore();
  const { agent } = useAgentStore();
  const { jobs, isLoading, fetchSchedules } = useScheduleStore();

  const loadData = useCallback(async () => {
    if (!isLoaded || !host) return;
    await fetchSchedules(host, mcpPort, authToken);
  }, [isLoaded, host, mcpPort, authToken, fetchSchedules]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Schedules',
    });
  }, [navigation]);

  // Empty state
  if (!isLoading && jobs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={52} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Schedules</Text>
        <Text style={styles.emptySubtitle}>
          Schedules let agents run proactively on a cron schedule.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item: ScheduleJob) => item.id}
        renderItem={({ item }) => {
          const agentData = agent(item.agentId);
          return (
            <ScheduleRow
              job={item}
              agentName={agentData?.name ?? 'Unknown'}
              agentColorName={agentData?.colorName ?? 'blue'}
              onPress={() =>
                router.push({
                  pathname: '/schedule/[id]',
                  params: { id: item.id },
                })
              }
            />
          );
        }}
        refreshing={isLoading}
        onRefresh={loadData}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={jobs.length === 0 ? styles.emptyList : undefined}
      />

      {/* Loading overlay when first fetch */}
      {isLoading && jobs.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  emptyContainer: {
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
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyList: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 72, // icon circle (44) + gap (12) + left padding (16)
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
