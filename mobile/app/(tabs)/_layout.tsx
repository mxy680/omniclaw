import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScheduleSyncStore } from '@/stores/useScheduleSyncStore';

const BLUE_TINT = '#007AFF';

export default function TabLayout() {
  const totalUnread = useScheduleSyncStore((s) => s.totalUnread());

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BLUE_TINT,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Messages',
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: { backgroundColor: BLUE_TINT },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'Schedules',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
