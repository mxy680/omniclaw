import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';

export default function ReportScreen() {
  const { jobName, response, timestamp } = useLocalSearchParams<{
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
      <Text style={styles.responseText} selectable>
        {response || '(no response)'}
      </Text>
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
  responseText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 22,
  },
});
