import React from "react";
import * as WebBrowser from "expo-web-browser";
import { LogBox, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
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
// i18n must be imported once so the synchronous init at module load runs
// before any screen tries to call `t(...)`. The async `bootstrapI18n()` call
// inside RootNav promotes the language to the user's stored choice / device
// locale on first mount.
import { bootstrapI18n, currentLanguage } from "./i18n";
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

/**
 * Build 20 only: visible diagnostic overlay so we can see, on a real TestFlight
 * device, why the dark loading screen was sticking. Flip to `false` once Build
 * 20 confirms the real app reaches LoginScreen, and ship the cleanup as Build 21.
 */
const SHOW_STARTUP_DIAG = true;
const APP_BUILD_LABEL = "v1.0.0 b20";

console.log("[startup] App.tsx module loaded", {
  buildLabel: APP_BUILD_LABEL,
  platform: Platform.OS,
  version: String(Platform.Version),
  ts: new Date().toISOString(),
});

/**
 * Startup error boundary. Replaces the silent iOS white-screen crash with a
 * readable error so TestFlight testers (and Sentry-less production builds) can
 * tell us what blew up before the navigation tree mounted. Class component is
 * required because `componentDidCatch` / `getDerivedStateFromError` only run on
 * class components in React.
 */
type StartupErrorBoundaryState = { error: Error | null };

class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  StartupErrorBoundaryState
> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to native logs so `xcrun simctl spawn ... log stream` and TestFlight crash logs
    // capture the real stack instead of an opaque white screen.
    console.error("[startup] fatal error before mount:", error?.message, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={errorStyles.root}>
        <ScrollView contentContainerStyle={errorStyles.scroll}>
          <Text style={errorStyles.title}>IFCDC Barbers couldn't start</Text>
          <Text style={errorStyles.subtitle}>
            Something failed before the app could load. Show this to support so we can fix it.
          </Text>
          <Text style={errorStyles.label}>Error</Text>
          <Text style={errorStyles.body} selectable>
            {error?.message || String(error)}
          </Text>
          {error?.stack ? (
            <>
              <Text style={errorStyles.label}>Stack</Text>
              <Text style={errorStyles.body} selectable>
                {error.stack}
              </Text>
            </>
          ) : null}
          <Text style={errorStyles.label}>Platform</Text>
          <Text style={errorStyles.body} selectable>
            {Platform.OS} {Platform.Version}
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0b" },
  scroll: { padding: 24, paddingTop: 72 },
  title: { color: "#F5C842", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#ddd", fontSize: 14, marginBottom: 20, lineHeight: 20 },
  label: {
    color: "#F5C842",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  body: { color: "#fff", fontSize: 13, lineHeight: 19 },
});

/**
 * Floating, non-interactive diagnostic banner. Pinned under the iOS status bar
 * so it cannot be hidden by a stuck overlay or empty navigator. Intentionally
 * cheap to render — no async work, no hooks beyond `useAuth` / `currentLanguage`.
 */
function StartupDiag({
  loading,
  token,
}: {
  loading: boolean;
  token: string | null;
}) {
  if (!SHOW_STARTUP_DIAG) return null;
  const lang = currentLanguage();
  return (
    <View style={diagStyles.banner} pointerEvents="none">
      <Text style={diagStyles.text} numberOfLines={1}>
        IFCDC {APP_BUILD_LABEL} · {Platform.OS} {String(Platform.Version)} · lang={lang}
      </Text>
      <Text style={diagStyles.text} numberOfLines={1}>
        loading={String(loading)} · token={token ? "yes" : "no"}
      </Text>
    </View>
  );
}

const diagStyles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 44,
    left: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: "rgba(245,200,66,0.55)",
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 9999,
    elevation: 9999,
  },
  text: { color: "#F5C842", fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
});

function RootNav() {
  const { loading, token } = useAuth();

  React.useEffect(() => {
    console.log("[startup] RootNav mounted", { initialLoading: loading });
    void bootstrapI18n()
      .then((lang) => console.log("[startup] i18n bootstrap done", { lang }))
      .catch((e) => console.warn("[startup] i18n bootstrap failed (ignored):", String(e)));
  }, []);

  React.useEffect(() => {
    console.log("[startup] auth state", {
      loading,
      hasToken: Boolean(token),
      ts: new Date().toISOString(),
    });
  }, [loading, token]);

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

  // Build 20: do NOT gate render on `loading`. The previous dark-screen gate
  // (#050505 fullscreen view) hid the app whenever SecureStore or /auth/me was
  // slow on a fresh install. Render the navigator immediately — when no token
  // is present (the default during refresh), the user lands on LoginScreen
  // right away and can interact. When refresh() later resolves with a real
  // token, React Navigation rebuilds the stack and switches to the App tabs.
  return (
    <View style={{ flex: 1, backgroundColor: "#050505" }}>
      <NavigationContainer
        onReady={() => console.log("[startup] NavigationContainer ready")}
      >
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
      <StartupDiag loading={loading} token={token} />
    </View>
  );
}

export default function App() {
  return (
    <StartupErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNav />
        </AuthProvider>
      </SafeAreaProvider>
    </StartupErrorBoundary>
  );
}

