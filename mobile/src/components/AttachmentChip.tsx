import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Attachment, isImage, isPDF } from '../types/attachment';

interface Props {
  attachment: Attachment;
  onRemove: (attachment: Attachment) => void;
}

export function AttachmentChip({ attachment, onRemove }: Props) {
  return (
    <View style={styles.container}>
      {isImage(attachment) && attachment.localUri ? (
        <Image
          source={{ uri: attachment.localUri }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={100}
        />
      ) : (
        <View style={styles.pdfPlaceholder}>
          <Ionicons name="document" size={28} color="#636366" />
          <Text style={styles.pdfFilename} numberOfLines={2}>
            {attachment.filename}
          </Text>
        </View>
      )}

      <Pressable
        style={styles.removeButton}
        onPress={() => onRemove(attachment)}
        hitSlop={4}
      >
        <Ionicons name="close-circle" size={20} color="#636366" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'visible',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  pdfPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    gap: 2,
  },
  pdfFilename: {
    fontSize: 9,
    color: '#3C3C43',
    textAlign: 'center',
    lineHeight: 11,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
});
