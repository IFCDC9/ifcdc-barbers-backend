import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NotFoundScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>404 - Not Found</Text>
      <Text style={styles.subMessage}>The page you're looking for doesn't exist.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  message: {
    fontSize: 24,
    color: '#333',
    marginBottom: 10,
  },
  subMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});

export default NotFoundScreen;