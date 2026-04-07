import React from 'react';
import { View, ViewStyle } from 'react-native';
import useColorScheme from '../hooks/useColorScheme';
import Colors from '../constants/Colors';

const ThemedView: React.FC<React.PropsWithChildren<{ style?: ViewStyle }>> = ({ style, children }) => {
  const colorScheme = useColorScheme();
  const backgroundColor =
    colorScheme === "dark"
      ? (Colors?.dark?.background ?? Colors?.background ?? "#050505")
      : (Colors?.light?.background ?? Colors?.background ?? "#f6f6f6");

  return (
    <View style={[{ backgroundColor, flex: 1 }, style]}>
      {children}
    </View>
  );
};

export default ThemedView;