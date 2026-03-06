import '../src/polyfills/crypto';
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@rn-primitives/portal';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function RootLayout() {
  const { isLoaded, load } = useSettingsStore();

  // Load settings on app startup
  useEffect(() => {
    if (!isLoaded) {
      load();
    }
  }, [isLoaded, load]);

  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: 'Back' }} />
        <Stack.Screen name="conversation/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="schedule/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="schedule/run/[runId]" options={{ headerShown: true, title: 'Run Result' }} />
      </Stack>
      <PortalHost />
    </SafeAreaProvider>
  );
}
