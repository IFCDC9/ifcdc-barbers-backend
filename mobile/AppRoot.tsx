/**
 * AppRoot.tsx — Build 22 controlled reintegration of the real provider tree
 * on top of Build 21's stable mount. This module is lazy-`require()`-d from
 * App.tsx, so any module-load throw here is caught and surfaced as
 * "System Recovery Mode" instead of a silent black screen.
 *
 * Build 22 boot phases:
 *   ROOT START    (App.tsx renders placeholder)        — Build 21 baseline
 *   STORAGE READY (AsyncStorage probe completed)       — phase 1
 *   AUTH READY    (SecureStore probe completed)        — phase 2
 *   API READY     (BACKEND_URL validated)              — phase 3
 *   NAV READY     (NavigationContainer onReady fired)  — after gate
 *   HOME READY    (Dashboard / Login mounted)          — final
 *
 * Build 22 intentionally re-enables ONLY the bare minimum auth flow so we
 * can prove the provider stack is stable end-to-end:
 *   - SafeAreaProvider
 *   - AuthProvider (auth context with SecureStore + /auth/me background)
 *   - i18n (synchronous module-load init)
 *   - NavigationContainer + native stack
 *   - LoginScreen, RegisterScreen, PasswordResetScreen, DashboardShell
 *
 * Deliberately deferred to later builds (re-enable one per build):
 *   - Tabs (Booking, Appointments, AURA, Profile, AdminStack)
 *   - All 9 legal/policy screens
 *   - expo-notifications service + push-token registration
 *   - Heavy animations / video backgrounds / realtime sockets (none of these
 *     exist in this codebase today, but listed for the playbook)
 */

import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// i18next must be imported before any screen using `useTranslation()`. The
// `./i18n` module's bottom calls `initSync()`, so this triggers the
// synchronous default-English init at import time.
import "./i18n";

import { AuthProvider, useAuth } from "./services/authContext";
import { BACKEND_URL } from "./constants/config";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import PasswordResetScreen from "./screens/PasswordResetScreen";

console.log("[startup] AppRoot module loaded");

const Stack = createStackNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// ProviderBoundary — fail-safe wrapper for each major provider. If anything
// inside throws during render, we render a labelled "System Recovery Mode"
// surface instead of letting the error bubble to a blank screen.
// ─────────────────────────────────────────────────────────────────────────────

class ProviderBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[startup] ProviderBoundary[${this.props.name}] caught:`,
      error?.message,
      info?.componentStack,
    );
  }

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    return (
      <View style={recoveryStyles.root}>
        <ScrollView contentContainerStyle={recoveryStyles.scroll}>
          <Text style={recoveryStyles.title}>System Recovery Mode</Text>
          <Text style={recoveryStyles.subtitle}>BUILD 22</Text>
          <View style={recoveryStyles.divider} />
          <Text style={recoveryStyles.label}>Failed provider</Text>
          <Text style={recoveryStyles.body} selectable>
            {this.props.name}
          </Text>
          <Text style={recoveryStyles.label}>Error</Text>
          <Text style={recoveryStyles.body} selectable>
            {err?.message || String(err)}
          </Text>
          {err?.stack ? (
            <>
              <Text style={recoveryStyles.label}>Stack</Text>
              <Text style={recoveryStyles.body} selectable>
                {err.stack}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BootProgress — visible feedback during the AuthGate phases.
// ─────────────────────────────────────────────────────────────────────────────

function BootProgress({ phase }: { phase: string }) {
  return (
    <View style={progressStyles.root}>
      <Text style={progressStyles.title}>IFCDC Barbers</Text>
      <View style={{ height: 16 }} />
      <ActivityIndicator color="#F5C842" />
      <View style={{ height: 12 }} />
      <Text style={progressStyles.subtitle}>Initializing… {phase}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthGate — sequential boot phases. Mounts the navigator only once storage,
// auth, and API config have each been probed. Critically, we do NOT block on
// `useAuth().loading` here (which performs the /auth/me network call that
// can hang up to 15s). The navigator renders as soon as the local probes
// complete; AuthProvider continues its background refresh and the navigator
// reactively switches token-aware routes when it finishes.
// ─────────────────────────────────────────────────────────────────────────────

type GatePhase = "storage" | "auth" | "api" | "ready";

function AuthGate() {
  const { token } = useAuth();
  const [phase, setPhase] = React.useState<GatePhase>("storage");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await AsyncStorage.getItem("@ifcdc/lang");
      } catch (e) {
        console.warn("[startup] AsyncStorage probe failed (ignored):", String(e));
      }
      if (cancelled) return;
      console.log("[startup] STORAGE READY");
      setPhase("auth");

      try {
        await SecureStore.getItemAsync("ifcdc_auth_token");
      } catch (e) {
        console.warn("[startup] SecureStore probe failed (ignored):", String(e));
      }
      if (cancelled) return;
      console.log("[startup] AUTH READY");
      setPhase("api");

      try {
        if (!BACKEND_URL || !/^https?:\/\//.test(BACKEND_URL)) {
          console.warn("[startup] API config invalid (continuing anyway):", BACKEND_URL);
        } else {
          console.log("[startup] API READY", { backend: BACKEND_URL });
        }
      } catch (e) {
        console.warn("[startup] API config probe threw (ignored):", String(e));
      }
      if (cancelled) return;
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase !== "ready") {
    return <BootProgress phase={phase.toUpperCase()} />;
  }

  return (
    <ProviderBoundary name="NavigationContainer">
      <NavigationContainer
        onReady={() => console.log("[startup] NAV READY", { hasToken: Boolean(token) })}
      >
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={token ? "Dashboard" : "Login"}
        >
          {token ? (
            <Stack.Screen name="Dashboard" component={DashboardShell} />
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ProviderBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardShell — minimal post-login placeholder. Booking, AURA, the rest
// of the tabs and admin tooling come back online in Build 23+.
// ─────────────────────────────────────────────────────────────────────────────

function DashboardShell() {
  const { user, signOut } = useAuth();

  React.useEffect(() => {
    console.log("[startup] HOME READY");
  }, []);

  const onSignOut = React.useCallback(async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn("[dashboard] sign-out failed:", String(e));
    }
  }, [signOut]);

  return (
    <View style={dashStyles.root}>
      <Text style={dashStyles.brand}>IFCDC Barbers</Text>
      <Text style={dashStyles.welcome}>
        Welcome back{user?.email ? `, ${user.email}` : ""}
      </Text>
      <View style={{ height: 24 }} />
      <Text style={dashStyles.note}>Build 22 dashboard shell</Text>
      <Text style={dashStyles.note}>
        Booking, services, AURA and the rest come back online in the next build.
      </Text>
      <View style={{ height: 32 }} />
      <Text style={dashStyles.signOut} onPress={onSignOut}>
        Sign out
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppRoot — the heavy provider tree, lazily required from App.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export default function AppRoot() {
  console.log("[startup] AppRoot render");
  return (
    <ProviderBoundary name="SafeAreaProvider">
      <SafeAreaProvider>
        <ProviderBoundary name="AuthProvider">
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ProviderBoundary>
      </SafeAreaProvider>
    </ProviderBoundary>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const progressStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#F5C842",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.0,
  },
  subtitle: {
    color: "#bdbdbd",
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
});

const dashStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    color: "#F5C842",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  welcome: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
  },
  note: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 17,
  },
  signOut: {
    color: "#F5C842",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

const recoveryStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0b" },
  scroll: { padding: 24, paddingTop: 72 },
  title: {
    color: "#F5C842",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.0,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: "#bdbdbd",
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "600",
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(245,200,66,0.45)",
    marginVertical: 18,
    width: 120,
    alignSelf: "center",
  },
  label: {
    color: "#F5C842",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  body: { color: "#fff", fontSize: 13, lineHeight: 19 },
});
