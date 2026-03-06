import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '@/hooks/useChat';
import { useAttachments } from '@/hooks/useAttachments';
import { useConversationStore } from '@/stores/useConversationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MessageBubble, BubblePosition } from '@/components/MessageBubble';
import { MessageInputBar } from '@/components/MessageInputBar';
import { DateHeader } from '@/components/DateHeader';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AgentAvatar } from '@/components/AgentAvatar';
import { uploadAttachment } from '@/services/AttachmentUploader';
import { Message } from '@/types/message';
import { Attachment } from '@/types/attachment';
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

/**
 * Builds the text prefix that references all uploaded attachments.
 * Format mirrors the iOS app: [Image: filename (attachment_id: id)]
 */
function buildAttachmentRefs(
  originals: Attachment[],
  uploadIds: Map<string, string>,
): string {
  return originals
    .map(a => {
      const serverId = uploadIds.get(a.id) ?? a.id;
      const tag = a.mimeType.startsWith('image/') ? 'Image' : 'File';
      return `[${tag}: ${a.filename} (attachment_id: ${serverId})]`;
    })
    .join('\n');
}

export default function ChatViewScreen() {
  const { id: conversationId, agentId } = useLocalSearchParams<{
    id: string;
    agentId: string;
  }>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { host, port, mcpPort, authToken, useTLS, isLoaded, load: loadSettings } = useSettingsStore();
  const { agents, fetch: fetchAgents } = useAgentStore();
  const { conversations } = useConversationStore();

  const chat = useChat(conversationId, agentId);
  const attachments = useAttachments();

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
      fetchAgents(host, port, authToken, useTLS);
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

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    // Snapshot pending attachments before any async work
    const pending = attachments.pendingAttachments.slice();

    if (!text && pending.length === 0) return;

    setUploadError(null);

    // Upload attachments first (before clearing UI state, so we can restore on error)
    const uploadedIds = new Map<string, string>();
    if (pending.length > 0) {
      try {
        await Promise.all(
          pending.map(async (a) => {
            const uploaded = await uploadAttachment(a, host, mcpPort, authToken);
            uploadedIds.set(a.id, uploaded.id);
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Attachment upload failed';
        setUploadError(msg);
        return; // Leave input and attachments intact so user can retry
      }
    }

    // All uploads succeeded — clear UI state and send
    setInputText('');
    attachments.clearPending();

    let finalText = text;
    if (pending.length > 0) {
      const refs = buildAttachmentRefs(pending, uploadedIds);
      finalText = refs + (text ? '\n' + text : '');
      // Pass the original pending attachments (with localUri) so the bubble can show thumbnails
      chat.sendMessage(finalText, pending);
    } else {
      chat.sendMessage(finalText);
    }
  }, [inputText, attachments, host, mcpPort, authToken, chat]);

  const handleCancel = useCallback(() => {
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

      {/* Error banners */}
      {chat.error && (
        <ErrorBanner message={chat.error} onDismiss={chat.clearError} />
      )}
      {uploadError && (
        <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} />
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

      {/* Full input bar with attachment support */}
      <MessageInputBar
        text={inputText}
        onChangeText={setInputText}
        pendingAttachments={attachments.pendingAttachments}
        isStreaming={chat.isStreaming}
        onSend={handleSend}
        onCancel={handleCancel}
        onPickFromLibrary={attachments.pickFromLibrary}
        onPickFromCamera={attachments.pickFromCamera}
        onPickFromFiles={attachments.pickDocument}
        onRemoveAttachment={attachments.removeAttachment}
      />
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
});
