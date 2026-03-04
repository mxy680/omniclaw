import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';

export default function ScheduleListScreen() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Schedules',
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Schedules</Text>
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
});
