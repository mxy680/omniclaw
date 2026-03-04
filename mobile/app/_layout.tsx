import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
            title: 'Settings',
            headerShown: false,
          }}
        />
        <Stack.Screen name="conversation/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="schedule/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="schedule/run/[runId]" options={{ headerShown: true }} />
      </Stack>
    </SafeAreaProvider>
  );
}
