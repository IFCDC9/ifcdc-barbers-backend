import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme';
import Colors from '../constants/Colors';

const ThemedView: React.FC<{ style?: ViewStyle }> = ({ style, children }) => {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;

  return (
    <View style={[{ backgroundColor, flex: 1 }, style]}>
      {children}
    </View>
  );
};

export default ThemedView;