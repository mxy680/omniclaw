import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  onReconnect: () => void;
}

export function ConnectionBanner({ onReconnect }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="wifi" size={14} color="#FF9500" />
      <Text style={styles.label}>Disconnected</Text>
      <Pressable onPress={onReconnect} hitSlop={8}>
        <Text style={styles.reconnect}>Reconnect</Text>
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
    backgroundColor: 'rgba(255,149,0,0.1)',
  },
  label: {
    fontSize: 12,
    color: '#333',
    marginLeft: 6,
    flex: 1,
  },
  reconnect: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
});
