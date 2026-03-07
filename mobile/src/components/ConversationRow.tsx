import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Conversation, lastMessage } from '../types/conversation';
import { Agent } from '../types/agent';
import { Attachment, isImage, isPDF } from '../types/attachment';
import { formatTimestamp } from '../lib/dates';
import { AgentAvatar } from './AgentAvatar';

interface Props {
  conversation: Conversation;
  agent: Agent;
  unreadCount?: number;
}

export function ConversationRow({ conversation, agent, unreadCount = 0 }: Props) {
  const last = lastMessage(conversation);
  const isUnread = unreadCount > 0;

  function preview(): string {
    if (!last) return '';
    if (last.content) return last.content;
    if (last.attachments.length === 0) return '...';
    const imageCount = last.attachments.filter((a: Attachment) => isImage(a)).length;
    const pdfCount = last.attachments.filter((a: Attachment) => isPDF(a)).length;
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} photo${imageCount > 1 ? 's' : ''}`);
    if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount > 1 ? 's' : ''}`);
    return parts.join(', ');
  }

  return (
    <Pressable
      style={styles.container}
      onPress={() =>
        router.push({
          pathname: '/conversation/[id]',
          params: { id: conversation.id, agentId: agent.id },
        })
      }
    >
      <AgentAvatar
        name={agent.name}
        colorName={agent.colorName}
        avatarIcon={agent.avatarIcon}
        avatarColor={agent.avatarColor}
      />
      <View style={styles.textContainer}>
        <View style={styles.topRow}>
          <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
            {agent.name}
          </Text>
          <View style={styles.timeRow}>
            {last && (
              <Text style={[styles.time, isUnread && styles.timeUnread]}>
                {formatTimestamp(last.timestamp)}
              </Text>
            )}
            {isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
        {agent.description && (
          <Text style={styles.description} numberOfLines={1}>{agent.description}</Text>
        )}
        {last && (
          <Text style={[styles.preview, isUnread && styles.previewUnread]} numberOfLines={2}>
            {preview()}
          </Text>
        )}
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
  },
  textContainer: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  name: { fontSize: 17, fontWeight: '600', color: '#000', flex: 1, marginRight: 8 },
  nameUnread: { fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontSize: 15, color: '#8E8E93' },
  timeUnread: { color: '#007AFF' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  description: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  preview: { fontSize: 15, color: '#8E8E93', marginTop: 2 },
  previewUnread: { color: '#000000' },
});
