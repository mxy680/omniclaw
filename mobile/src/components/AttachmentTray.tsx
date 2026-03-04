import { FlatList, StyleSheet, View } from 'react-native';
import { Attachment } from '../types/attachment';
import { AttachmentChip } from './AttachmentChip';

interface Props {
  attachments: Attachment[];
  onRemove: (attachment: Attachment) => void;
}

export function AttachmentTray({ attachments, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <FlatList
        data={attachments}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AttachmentChip attachment={item} onRemove={onRemove} />
        )}
        contentContainerStyle={styles.listContent}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  separator: {
    width: 8,
  },
});
