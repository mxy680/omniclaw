import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types/message';
import { Attachment, isImage, isPDF } from '../types/attachment';
import { TypingIndicator } from './TypingIndicator';
import { ImageAttachmentView } from './ImageAttachmentView';
import { PDFAttachmentView } from './PDFAttachmentView';

export type BubblePosition = 'standalone' | 'first' | 'middle' | 'last';

interface Props {
  message: Message;
  position: BubblePosition;
}

const LARGE = 18;
const SMALL = 4;

function userRadii(position: BubblePosition) {
  switch (position) {
    case 'standalone':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: LARGE, borderBottomLeftRadius: LARGE, borderBottomRightRadius: LARGE };
    case 'first':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: LARGE, borderBottomLeftRadius: LARGE, borderBottomRightRadius: SMALL };
    case 'middle':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: SMALL, borderBottomLeftRadius: LARGE, borderBottomRightRadius: SMALL };
    case 'last':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: SMALL, borderBottomLeftRadius: LARGE, borderBottomRightRadius: LARGE };
  }
}

function assistantRadii(position: BubblePosition) {
  switch (position) {
    case 'standalone':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: LARGE, borderBottomLeftRadius: LARGE, borderBottomRightRadius: LARGE };
    case 'first':
      return { borderTopLeftRadius: LARGE, borderTopRightRadius: LARGE, borderBottomLeftRadius: SMALL, borderBottomRightRadius: LARGE };
    case 'middle':
      return { borderTopLeftRadius: SMALL, borderTopRightRadius: LARGE, borderBottomLeftRadius: SMALL, borderBottomRightRadius: LARGE };
    case 'last':
      return { borderTopLeftRadius: SMALL, borderTopRightRadius: LARGE, borderBottomLeftRadius: LARGE, borderBottomRightRadius: LARGE };
  }
}

function AttachmentInBubble({
  attachment,
  isUser,
}: {
  attachment: Attachment;
  isUser: boolean;
}) {
  if (isImage(attachment) && attachment.localUri) {
    return <ImageAttachmentView attachment={attachment} />;
  }
  if (isPDF(attachment)) {
    return <PDFAttachmentView attachment={attachment} isUserBubble={isUser} />;
  }
  // Generic fallback for unknown types
  return (
    <View style={styles.attachmentChip}>
      <Text style={styles.attachmentLabel} numberOfLines={1}>
        {attachment.filename}
      </Text>
    </View>
  );
}

export function MessageBubble({ message, position }: Props) {
  const isUser = message.role === 'user';
  const radii = isUser ? userRadii(position) : assistantRadii(position);
  const bubbleColor = isUser ? styles.userBubble : styles.assistantBubble;
  const textColor = isUser ? styles.userText : styles.assistantText;

  const showTyping = !isUser && message.isStreaming && !message.content;
  const isSchedule = message.metadata?.source === 'schedule';

  if (isSchedule && message.metadata) {
    return (
      <View style={[styles.row, styles.rowLeft]}>
        <Pressable
          style={[styles.scheduleBubble, assistantRadii('standalone')]}
          onPress={() =>
            router.push({
              pathname: '/report/[id]',
              params: {
                id: message.metadata!.runId,
                jobName: message.metadata!.jobName,
                response: message.metadata!.response,
                timestamp: message.timestamp,
              },
            })
          }
        >
          <View style={styles.scheduleContent}>
            <Ionicons name="document-text-outline" size={16} color="#007AFF" />
            <Text style={styles.scheduleTitle}>{message.content}</Text>
            <Ionicons name="chevron-forward" size={14} color="#C7C7CC" />
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, bubbleColor, radii]}>
        {message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map((a: Attachment) => (
              <AttachmentInBubble key={a.id} attachment={a} isUser={isUser} />
            ))}
          </View>
        )}
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <Text style={[styles.text, textColor]} selectable>{message.content}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userBubble: {
    backgroundColor: '#007AFF',
  },
  assistantBubble: {
    backgroundColor: '#E9E9EB',
  },
  text: {
    fontSize: 16,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#000000',
  },
  attachments: {
    gap: 4,
    marginBottom: 6,
  },
  attachmentChip: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attachmentLabel: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  scheduleBubble: {
    backgroundColor: '#E9E9EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scheduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
});
