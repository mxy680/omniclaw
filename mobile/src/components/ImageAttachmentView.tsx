import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Attachment } from '../types/attachment';

interface Props {
  attachment: Attachment;
}

export function ImageAttachmentView({ attachment }: Props) {
  const uri = attachment.localUri ?? null;
  if (!uri) return null;

  return (
    <Image
      source={{ uri }}
      style={styles.image}
      contentFit="cover"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: 220,
    height: 165, // 4:3 default aspect ratio; expo-image will respect contentFit
    borderRadius: 12,
    marginBottom: 4,
  },
});
