import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function ConversationListScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Messages',
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.headerButton}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={22} color="#007AFF" />
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Messages</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
  },
  text: {
    fontSize: 17,
    color: '#8E8E93',
  },
  headerButton: {
    paddingHorizontal: 4,
  },
});
