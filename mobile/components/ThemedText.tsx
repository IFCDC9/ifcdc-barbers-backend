import React from 'react';
import { Text, TextProps } from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme';
import Colors from '../constants/Colors';

const ThemedText: React.FC<TextProps> = (props) => {
  const colorScheme = useColorScheme();
  const textColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;

  return <Text {...props} style={[{ color: textColor }, props.style]} />;
};

export default ThemedText;