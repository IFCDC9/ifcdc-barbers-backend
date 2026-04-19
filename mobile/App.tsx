import React from "react";
import * as WebBrowser from "expo-web-browser";
import { LogBox, View } from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import Tabs from "./app/_layout";
import { addNotificationListeners } from "./services/notificationService";
import AIFloatingButton from "./components/AIFloatingButton";
import AIAssistantSheet from "./components/AIAssistantSheet";
import { AuthProvider, useAuth } from "./services/authContext";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";

WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreLogs([
  "Constants.platform.ios.model has been deprecated in favor of expo-device's Device.modelName property. This API will be removed in SDK 45.",
  "The useProxy option is deprecated and will be removed in a future release, for more information check https://expo.fyi/auth-proxy-migration.",
]);

const Stack = createStackNavigator();

function RootNav() {
  const { loading, token } = useAuth();
  const [aiOpen, setAiOpen] = React.useState(false);

  React.useEffect(() => {
    const remove = addNotificationListeners({
      onReceived: (n) => {
        console.log("[notif] received (foreground):", n.request?.content?.title, n.request?.content?.body);
      },
      onResponse: (r) => {
        console.log("[notif] response (tap):", r.notification?.request?.content?.data);
      },
    });
    return remove;
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#050505" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {token ? (
            <Stack.Screen name="App" component={Tabs} />
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {token ? (
        <>
          <AIFloatingButton onPress={() => setAiOpen(true)} />
          <AIAssistantSheet visible={aiOpen} onClose={() => setAiOpen(false)} />
        </>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNav />
    </AuthProvider>
  );
}

