import { useColorScheme as useRNCColorScheme } from 'react-native-appearance';

const useColorScheme = () => {
  const colorScheme = useRNCColorScheme();
  return colorScheme;
};

export default useColorScheme;