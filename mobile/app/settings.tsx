import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ChatService } from '@/services/ChatService';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'failure';

export default function SettingsScreen() {
  const store = useSettingsStore();

  // Local state mirrors the store so edits are buffered until Save/Done
  const [host, setHost] = useState(store.host);
  const [port, setPort] = useState(String(store.port));
  const [mcpPort, setMcpPort] = useState(String(store.mcpPort));
  const [authToken, setAuthToken] = useState(store.authToken);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const chatServiceRef = useRef(new ChatService());

  // Load settings on mount if not already loaded
  useEffect(() => {
    if (!store.isLoaded) {
      store.load();
    }
  }, []);

  // Sync local state once the store has finished loading
  useEffect(() => {
    if (store.isLoaded) {
      setHost(store.host);
      setPort(String(store.port));
      setMcpPort(String(store.mcpPort));
      setAuthToken(store.authToken);
    }
  }, [store.isLoaded]);

  function handleDone() {
    const parsedPort = parseInt(port, 10);
    const parsedMcpPort = parseInt(mcpPort, 10);

    store.setHost(host);
    if (!isNaN(parsedPort)) store.setPort(parsedPort);
    if (!isNaN(parsedMcpPort)) store.setMcpPort(parsedMcpPort);
    store.setAuthToken(authToken);

    router.back();
  }

  async function handleTestConnection() {
    setConnectionStatus('testing');
    setConnectionError(null);
    try {
      const parsedPort = parseInt(port, 10) || 18789;
      await chatServiceRef.current.testConnection({ host, port: parsedPort, authToken });
      setConnectionStatus('success');
    } catch (err) {
      setConnectionStatus('failure');
      setConnectionError(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  const wsUrl = `ws://${host || 'localhost'}:${port || store.port}`;

  const testButtonLabel =
    connectionStatus === 'testing'
      ? 'Testing…'
      : connectionStatus === 'success'
        ? 'Connected'
        : connectionStatus === 'failure'
          ? 'Failed — Retry'
          : 'Test Connection';

  const testButtonColor =
    connectionStatus === 'success'
      ? '#34C759'
      : connectionStatus === 'failure'
        ? '#FF3B30'
        : '#007AFF';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Navigation header */}
      <View style={styles.navBar}>
        <View style={styles.navBarSide} />
        <Text style={styles.navBarTitle}>Settings</Text>
        <View style={styles.navBarSide}>
          <Pressable onPress={handleDone} hitSlop={8}>
            <Text style={styles.doneButton}>Done</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gateway Connection section */}
        <Text style={styles.sectionHeader}>GATEWAY CONNECTION</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Host</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="localhost"
              placeholderTextColor="#C7C7CC"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="18789"
              placeholderTextColor="#C7C7CC"
              keyboardType="number-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.label}>Auth Token</Text>
            <TextInput
              style={styles.input}
              value={authToken}
              onChangeText={setAuthToken}
              placeholder="Token"
              placeholderTextColor="#C7C7CC"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* MCP Server section */}
        <Text style={styles.sectionHeader}>MCP SERVER</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>MCP Port</Text>
            <TextInput
              style={styles.input}
              value={mcpPort}
              onChangeText={setMcpPort}
              placeholder="9850"
              placeholderTextColor="#C7C7CC"
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Test Connection button */}
        <View style={styles.buttonSection}>
          <Pressable
            style={[styles.testButton, { borderColor: testButtonColor }]}
            onPress={handleTestConnection}
            disabled={connectionStatus === 'testing'}
          >
            {connectionStatus === 'testing' ? (
              <ActivityIndicator color={testButtonColor} size="small" />
            ) : null}
            <Text style={[styles.testButtonLabel, { color: testButtonColor }]}>
              {testButtonLabel}
            </Text>
          </Pressable>
          {connectionError && (
            <Text style={styles.errorText}>{connectionError}</Text>
          )}
        </View>

        {/* Info section */}
        <Text style={styles.sectionHeader}>INFO</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>WebSocket URL</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {wsUrl}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          The gateway connects your mobile app to the Omniclaw backend. Ensure
          the host is reachable on your local network.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // Navigation bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  navBarSide: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  navBarTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  doneButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Section header label
  sectionHeader: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6D6D72',
    letterSpacing: 0.4,
    marginTop: 24,
    marginBottom: 6,
    marginHorizontal: 20,
    textTransform: 'uppercase',
  },

  // White card section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    overflow: 'hidden',
  },

  // Row inside a section
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
  },
  label: {
    fontSize: 17,
    color: '#000',
    width: 120,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    textAlign: 'right',
    paddingVertical: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'right',
  },

  // Hairline separator between rows
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 16,
  },

  // Test Connection button section
  buttonSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  testButtonLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 8,
  },

  // Footer note
  footer: {
    fontSize: 13,
    color: '#8E8E93',
    marginHorizontal: 20,
    marginTop: 8,
    lineHeight: 18,
  },
});
