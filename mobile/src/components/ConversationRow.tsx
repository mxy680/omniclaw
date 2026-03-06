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
}

export function ConversationRow({ conversation, agent }: Props) {
  const last = lastMessage(conversation);

  function preview(): string {
    if (!last) return agent.role;
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
          <Text style={styles.name} numberOfLines={1}>{agent.name}</Text>
          {last && <Text style={styles.time}>{formatTimestamp(last.timestamp)}</Text>}
        </View>
        {agent.description && (
          <Text style={styles.description} numberOfLines={1}>{agent.description}</Text>
        )}
        <Text style={[styles.preview, !last && styles.previewDim]} numberOfLines={2}>
          {preview()}
        </Text>
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
  time: { fontSize: 15, color: '#8E8E93' },
  description: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  preview: { fontSize: 15, color: '#8E8E93', marginTop: 2 },
  previewDim: { color: '#C7C7CC' },
});
