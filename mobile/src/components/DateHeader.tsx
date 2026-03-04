import { Text, StyleSheet } from 'react-native';
import { formatChatDate } from '../lib/dates';

interface Props {
  date: string;
}

export function DateHeader({ date }: Props) {
  return <Text style={styles.text}>{formatChatDate(date)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
