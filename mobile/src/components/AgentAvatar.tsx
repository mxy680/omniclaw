import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { agentColor } from '../lib/colors';

interface Props {
  name: string;
  colorName: string;
  size?: number;
  /** Icon spec, e.g. "material:gmail" or "ionicons:mail" */
  avatarIcon?: string;
  /** Override background color (hex) */
  avatarColor?: string;
}

export function AgentAvatar({ name, colorName, size = 48, avatarIcon, avatarColor }: Props) {
  const bg = avatarColor ?? agentColor(colorName);
  const iconSize = size * 0.52;
  const fontSize = size * 0.42;

  let content: React.ReactNode;
  if (avatarIcon) {
    const [lib, iconName] = avatarIcon.split(':');
    if (lib === 'material') {
      content = <MaterialCommunityIcons name={iconName as any} size={iconSize} color="#FFFFFF" />;
    } else {
      content = <Ionicons name={iconName as any} size={iconSize} color="#FFFFFF" />;
    }
  } else {
    content = <Text style={[styles.initial, { fontSize }]}>{name.charAt(0).toUpperCase()}</Text>;
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  initial: { fontWeight: '600', color: '#FFFFFF' },
});
