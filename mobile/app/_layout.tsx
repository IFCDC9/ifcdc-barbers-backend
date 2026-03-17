import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ExploreScreen from './(tabs)/explore';
import ProfileScreen from './(tabs)/profile';
import Colors from '../constants/Colors';
import ThemedView from '../components/ThemedView';

const Tab = createBottomTabNavigator();

const Layout = () => {
  return (
    <NavigationContainer>
      <ThemedView style={{ flex: 1, backgroundColor: Colors.background }}>
        <Tab.Navigator>
          <Tab.Screen name="Explore" component={ExploreScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </ThemedView>
    </NavigationContainer>
  );
};

export default Layout;