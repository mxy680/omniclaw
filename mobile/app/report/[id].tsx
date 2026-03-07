import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import Markdown from '@ronradtke/react-native-markdown-display';

export default function ReportScreen() {
  const { jobName, response } = useLocalSearchParams<{
    id: string;
    jobName: string;
    response: string;
    timestamp: string;
  }>();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: jobName ?? 'Report',
    });
  }, [navigation, jobName]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <Markdown style={mdStyles}>{response || '(no response)'}</Markdown>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
});

const mdStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
    marginBottom: 4,
  },
  strong: {
    fontWeight: '700',
  },
  hr: {
    backgroundColor: '#E5E5EA',
    height: 1,
    marginVertical: 12,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: '#F2F2F7',
  },
  th: {
    padding: 8,
    fontWeight: '600',
    fontSize: 13,
  },
  td: {
    padding: 8,
    fontSize: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  code_inline: {
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 14,
    fontFamily: 'Menlo',
  },
  fence: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontSize: 14,
    fontFamily: 'Menlo',
  },
});
