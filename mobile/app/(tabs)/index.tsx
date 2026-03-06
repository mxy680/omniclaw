import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useConversationStore } from '@/stores/useConversationStore';
import { ConversationRow } from '@/components/ConversationRow';
import { Conversation } from '@/types/conversation';

export default function ConversationListScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const { host, port, authToken, useTLS, isLoaded } = useSettingsStore();
  const { agents, isLoading, fetch: fetchAgents } = useAgentStore();
  const { conversations, load: loadConversations, ensureDefaultConversations } = useConversationStore();

  const loadData = useCallback(async () => {
    if (!isLoaded || !host) return;
    await fetchAgents(host, port, authToken, useTLS);
  }, [isLoaded, host, port, authToken, useTLS, fetchAgents]);

  // Initial load: conversations from disk, then agents from server
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create default conversations whenever the agent list changes
  useEffect(() => {
    if (agents.length > 0) {
      ensureDefaultConversations(agents);
    }
  }, [agents, ensureDefaultConversations]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Messages',
      headerLeft: () => (
        <Pressable
          style={styles.headerButton}
          onPress={() => router.push('/settings')}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={22} color="#007AFF" />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          style={styles.headerButton}
          onPress={loadData}
          hitSlop={8}
        >
          <Ionicons name="refresh" size={22} color="#007AFF" />
        </Pressable>
      ),
    });
  }, [navigation, loadData]);

  // Filter and sort conversations
  const agentMap = new Map(agents.map(a => [a.id, a]));

  const filteredConversations: Conversation[] = conversations
    .filter(c => {
      const agent = agentMap.get(c.agentId);
      if (!agent) return false;
      if (!searchQuery) return true;
      return agent.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!host) {
    return (
      <View style={styles.centered}>
        <Ionicons name="settings-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Server Configured</Text>
        <Text style={styles.emptySubtitle}>Configure your server address in Settings.</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading && agents.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading agents...</Text>
      </View>
    );
  }

  if (!isLoading && agents.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-outline" size={48} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Agents Found</Text>
        <Text style={styles.emptySubtitle}>Make sure your server is running and reachable.</Text>
        <Pressable style={styles.settingsButton} onPress={loadData}>
          <Text style={styles.settingsButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const agent = agentMap.get(item.agentId);
          if (!agent) return null;
          return <ConversationRow conversation={item} agent={agent} />;
        }}
        refreshing={isLoading}
        onRefresh={loadData}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={filteredConversations.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptySubtitle}>No conversations match your search.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    gap: 12,
    padding: 32,
  },
  emptyList: {
    flex: 1,
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
  loadingText: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
  },
  settingsButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerButton: {
    paddingHorizontal: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    padding: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 76, // avatar width (48) + horizontal padding (16) + gap (12)
  },
});
