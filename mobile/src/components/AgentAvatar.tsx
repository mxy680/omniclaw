import { View, Text, StyleSheet } from 'react-native';
import { agentColor } from '../lib/colors';

interface Props {
  name: string;
  colorName: string;
  size?: number;
}

export function AgentAvatar({ name, colorName, size = 48 }: Props) {
  const color = agentColor(colorName);
  const fontSize = size * 0.42;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.initial, { fontSize }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  initial: { fontWeight: '600', color: '#FFFFFF' },
});
