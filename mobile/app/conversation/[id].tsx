import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '@/hooks/useChat';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MessageBubble, BubblePosition } from '@/components/MessageBubble';
import { DateHeader } from '@/components/DateHeader';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AgentAvatar } from '@/components/AgentAvatar';
import { Message } from '@/types/message';
import { shouldShowDateHeader } from '@/lib/dates';
import { differenceInMinutes } from 'date-fns';

// A rendered item is either a message or a date header.
type ListItem =
  | { kind: 'message'; message: Message; position: BubblePosition; topPadding: number }
  | { kind: 'date'; date: string };

const GROUP_BREAK_MINUTES = 5;

function computeListItems(messages: Message[]): ListItem[] {
  // Filter system messages
  const visible = messages.filter(m => m.role !== 'system');
  const items: ListItem[] = [];

  for (let i = 0; i < visible.length; i++) {
    const msg = visible[i];
    const prev = i > 0 ? visible[i - 1] : null;
    const next = i < visible.length - 1 ? visible[i + 1] : null;

    // Determine if a date break exists between prev and current
    const dateBreakBefore =
      !prev ||
      shouldShowDateHeader(msg.timestamp, prev.timestamp);

    // Show date header before this message if there's a break
    if (dateBreakBefore) {
      items.push({ kind: 'date', date: msg.timestamp });
    }

    // Determine group continuity (same role + within 5 min)
    const continuesFromPrev =
      !!prev &&
      prev.role === msg.role &&
      !dateBreakBefore;

    const continuestoNext =
      !!next &&
      next.role === msg.role &&
      differenceInMinutes(new Date(next.timestamp), new Date(msg.timestamp)) <= GROUP_BREAK_MINUTES;

    let position: BubblePosition;
    if (continuesFromPrev && continuestoNext) {
      position = 'middle';
    } else if (continuesFromPrev && !continuestoNext) {
      position = 'last';
    } else if (!continuesFromPrev && continuestoNext) {
      position = 'first';
    } else {
      position = 'standalone';
    }

    // Top padding: 1 for same sender continuation, 8 for sender change
    const topPadding = continuesFromPrev ? 1 : 8;

    items.push({ kind: 'message', message: msg, position, topPadding });
  }

  return items;
}

export default function ChatViewScreen() {
  const { id: conversationId, agentId } = useLocalSearchParams<{
    id: string;
    agentId: string;
  }>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');

  const { host, port, authToken, isLoaded, load: loadSettings } = useSettingsStore();
  const { agents, fetch: fetchAgents } = useAgentStore();
  const { conversations } = useConversationStore();

  const chat = useChat(conversationId, agentId);

  const conversation = conversations.find(c => c.id === conversationId);
  const agent = agents.find(a => a.id === agentId);

  // Load settings and agents on mount if needed
  useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  useEffect(() => {
    if (isLoaded && host && agents.length === 0) {
      fetchAgents(host, port, authToken);
    }
  }, [isLoaded, host, port, authToken, agents.length, fetchAgents]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (isLoaded && host) {
      chat.connect();
    }
    return () => {
      chat.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, host]);

  // Configure navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () =>
        agent ? (
          <View style={styles.headerTitle}>
            <AgentAvatar name={agent.name} colorName={agent.colorName} size={32} />
            <Text style={styles.headerName}>{agent.name}</Text>
          </View>
        ) : null,
      headerRight: () => (
        <Pressable
          style={styles.headerButton}
          onPress={() => {
            // Show action sheet or menu for Clear Chat
            chat.clear();
          }}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#007AFF" />
        </Pressable>
      ),
    });
  }, [navigation, agent, chat]);

  const listItems = conversation ? computeListItems(conversation.messages) : [];

  const scrollToBottom = useCallback(() => {
    if (listItems.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [listItems.length]);

  // Auto-scroll when messages update
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [listItems.length, scrollToBottom]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    chat.sendMessage(text);
  }, [inputText, chat]);

  const handleAbort = useCallback(() => {
    chat.abort();
  }, [chat]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'date') {
        return (
          <View style={styles.dateHeaderWrapper}>
            <DateHeader date={item.date} />
          </View>
        );
      }
      return (
        <View style={{ paddingTop: item.topPadding }}>
          <MessageBubble message={item.message} position={item.position} />
        </View>
      );
    },
    []
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'date') return `date-${item.date}`;
    return item.message.id;
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Connection banner — only shown after first connection attempt */}
      {chat.hasConnected && !chat.isConnected && (
        <ConnectionBanner onReconnect={chat.connect} />
      )}

      {/* Error banner */}
      {chat.error && (
        <ErrorBanner message={chat.error} onDismiss={chat.clearError} />
      )}

      <FlatList
        ref={flatListRef}
        data={listItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        onContentSizeChange={scrollToBottom}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor="#8E8E93"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={4000}
          returnKeyType="default"
          enablesReturnKeyAutomatically
        />
        {chat.isStreaming ? (
          <Pressable style={styles.stopButton} onPress={handleAbort} hitSlop={8}>
            <View style={styles.stopIcon} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            hitSlop={8}
          >
            <Ionicons name="arrow-up-circle" size={32} color={inputText.trim() ? '#007AFF' : '#C7C7CC'} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  headerButton: {
    paddingHorizontal: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  dateHeaderWrapper: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 1,
  },
  stopButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    marginBottom: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
