import React from "react";
import * as WebBrowser from "expo-web-browser";
import { LogBox, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import Tabs from "./app/_layout";
import {
  addNotificationListeners,
  registerForPushNotificationsAsync,
} from "./services/notificationService";
import { registerPushToken } from "./services/pushApi";
import { AuthProvider, useAuth } from "./services/authContext";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import LegalPoliciesIndexScreen from "./screens/legal/LegalPoliciesIndexScreen";
import PrivacyPolicyScreen from "./screens/legal/PrivacyPolicyScreen";
import TermsConditionsScreen from "./screens/legal/TermsConditionsScreen";
import CancellationPolicyScreen from "./screens/legal/CancellationPolicyScreen";
import PlatformFeeDisclosureScreen from "./screens/legal/PlatformFeeDisclosureScreen";
import AuraDisclosureScreen from "./screens/legal/AuraDisclosureScreen";
import BarberTermsScreen from "./screens/legal/BarberTermsScreen";
import NotificationConsentScreen from "./screens/legal/NotificationConsentScreen";
import SecurityNoticeScreen from "./screens/legal/SecurityNoticeScreen";

WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreLogs([
  "Constants.platform.ios.model has been deprecated in favor of expo-device's Device.modelName property. This API will be removed in SDK 45.",
  "The useProxy option is deprecated and will be removed in a future release, for more information check https://expo.fyi/auth-proxy-migration.",
]);

const Stack = createStackNavigator();

function RootNav() {
  const { loading, token } = useAuth();

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

  // Register the device's Expo push token with the backend whenever the user
  // is signed in. Best-effort — never blocks navigation or shows errors. If
  // permission isn't granted, this is a no-op (the user can re-enable from
  // Notifications settings later).
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await registerForPushNotificationsAsync();
        if (cancelled) return;
        if (state.expoPushToken) {
          await registerPushToken(state.expoPushToken);
        }
      } catch {
        /* swallowed — push registration must never block sign-in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: "#050505" }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={token ? "App" : "Login"}
        >
          {token ? (
            <Stack.Screen name="App" component={Tabs} />
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="LegalPolicies" component={LegalPoliciesIndexScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
              <Stack.Screen name="CancellationPolicy" component={CancellationPolicyScreen} />
              <Stack.Screen name="PlatformFeeDisclosure" component={PlatformFeeDisclosureScreen} />
              <Stack.Screen name="AuraDisclosure" component={AuraDisclosureScreen} />
              <Stack.Screen name="BarberTerms" component={BarberTermsScreen} />
              <Stack.Screen name="NotificationConsent" component={NotificationConsentScreen} />
              <Stack.Screen name="SecurityNotice" component={SecurityNoticeScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

