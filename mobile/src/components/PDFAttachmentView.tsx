import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Attachment } from '../types/attachment';

interface Props {
  attachment: Attachment;
  isUserBubble?: boolean;
}

export function PDFAttachmentView({ attachment, isUserBubble = false }: Props) {
  return (
    <Pressable style={styles.container} onPress={() => {
      // Preview not yet implemented — placeholder for future
    }}>
      <Ionicons
        name="document-text"
        size={24}
        color={isUserBubble ? '#FFFFFF' : '#3C3C43'}
      />
      <View style={styles.info}>
        <Text
          style={[styles.filename, isUserBubble && styles.filenameLight]}
          numberOfLines={2}
        >
          {attachment.filename}
        </Text>
        <Text style={[styles.meta, isUserBubble && styles.metaLight]}>
          PDF
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={isUserBubble ? 'rgba(255,255,255,0.7)' : '#C7C7CC'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  filename: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    lineHeight: 18,
  },
  filenameLight: {
    color: '#FFFFFF',
  },
  meta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  metaLight: {
    color: 'rgba(255,255,255,0.7)',
  },
});
