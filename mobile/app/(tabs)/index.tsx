import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ExploreScreen from './explore';
import ProfileScreen from './profile';
import PaymentScreen from './payment';

const Tab = createBottomTabNavigator();

function PaymentTabScreen() {
  return (
    <PaymentScreen
      onSuccess={(bookingId, orderId) => {
        console.log(`Paid booking ${bookingId}, order ${orderId}`);
      }}
      onCancel={() => console.log("Payment cancelled")}
    />
  );
}

const Index = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Payment" component={PaymentTabScreen} options={{ title: "Payments" }} />
    </Tab.Navigator>
  );
};

export default Index;