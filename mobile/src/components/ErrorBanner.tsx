import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={14} color="#FF3B30" />
      <Text style={styles.label} numberOfLines={2}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={16} color="#FF3B30" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  label: {
    fontSize: 12,
    color: '#333',
    marginLeft: 6,
    flex: 1,
    marginRight: 6,
  },
});
