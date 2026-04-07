import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ExploreScreen from "./(tabs)/explore";
import PaymentScreen from "./(tabs)/payment";
import ProfileScreen from "./(tabs)/profile";
import Colors from "../constants/Colors";
import ThemedView from "../components/ThemedView";
import AIFloatingButton from "../components/AIFloatingButton";
import AIAssistantSheet from "../components/AIAssistantSheet";

const Tab = createBottomTabNavigator();

const Tabs = () => {
  const [aiOpen, setAiOpen] = React.useState(false);
  return (
    <ThemedView style={{ flex: 1, backgroundColor: Colors.background }}>
      <Tab.Navigator>
        <Tab.Screen name="Explore" component={ExploreScreen} />
        <Tab.Screen name="Book" component={PaymentScreen} options={{ title: "Payments" }} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      {/* AURA: floating assistant */}
      <AIFloatingButton onPress={() => setAiOpen(true)} />
      <AIAssistantSheet visible={aiOpen} onClose={() => setAiOpen(false)} />
    </ThemedView>
  );
};

export default Tabs;