import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import BookingScreen from '../screens/BookingScreen';

const Tab = createBottomTabNavigator();

function HomeScreen() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Text style={{
        color: '#FFD700',
        fontSize: 22,
        fontWeight: 'bold'
      }}>
        IFCDC BARBERS
      </Text>

      <Text style={{
        color: '#fff',
        marginTop: 10
      }}>
        Book your cut. Stay sharp.
      </Text>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Text style={{ color: '#FFD700', fontSize: 20 }}>
        Profile Dashboard
      </Text>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#FFD700',
        tabBarStyle: { backgroundColor: '#000' },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Booking" component={BookingScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
