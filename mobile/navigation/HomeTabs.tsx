/**
 * HomeTabs — the post-auth Tab.Navigator for Build 23.
 *
 * Replaces the Build 22 `DashboardShell` placeholder with the real customer
 * surface. Critically, every tab is mounted through `<LazyScreen />`, which
 * means:
 *
 *   - A module-load throw inside any tab's transitive imports renders a
 *     "Feature unavailable" card on that tab only — the rest of the tab bar
 *     keeps working. This is the property the user demanded: one broken
 *     feature must never crash the entire app again.
 *
 *   - Each tab gets a `SafeAreaView` per LazyScreen, so notch / Dynamic
 *     Island / home indicator never clip content regardless of which
 *     screen the user is on.
 *
 *   - Loading states are visible (gold ActivityIndicator + label) — never
 *     blank — during the brief deferred-require window.
 *
 * Loaders are declared at module scope so React.useEffect's dependency
 * array sees the same function identity across re-renders. Inline
 * `() => require(...)` would re-run the effect every render.
 *
 * Tabs in this build:
 *
 *   1. Home    -> app/(tabs)/explore.tsx
 *   2. Book    -> screens/BookingScreen.js
 *   3. AURA    -> screens/AuraScreen.tsx
 *   4. Profile -> app/(tabs)/profile.tsx        (re-exports navigation/ProfileStack)
 *   5. Admin   -> navigation/AdminStack.tsx     (only when `isPlatformAdmin`)
 *
 * Services / Roster / Payment / Notifications are NOT tabs — they are
 * deeper destinations reachable from inside Book and Profile, and they
 * receive the same LazyScreen treatment when they are wired into stack
 * routes in subsequent builds. Keeping the visible tab count to five
 * preserves the Build 22 stable shell footprint and matches the design
 * the customer base is already used to.
 */

import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../services/authContext";
import { LazyScreen } from "../components/LazyScreen";

const Tab = createBottomTabNavigator();

const ACCENT = "#F5C842";
const INACTIVE = "#7d7d7d";
const TAB_BG = "rgba(8,8,8,0.96)";

type Loader = () => unknown;

// Stable loader references — declared at module scope so LazyScreen's
// useEffect dependency array sees a constant function identity.
const HOME_LOADER: Loader = () => require("../app/(tabs)/explore");
const BOOK_LOADER: Loader = () => require("../screens/BookingScreen");
const AURA_LOADER: Loader = () => require("../screens/AuraScreen");
const PROFILE_LOADER: Loader = () => require("../app/(tabs)/profile");
const ADMIN_LOADER: Loader = () => require("./AdminStack");

// Each tab is a thin wrapper component declared at module scope so React
// Navigation gets a stable component identity per tab. Defining these
// inside the parent render would cause a remount per parent render.
function HomeTabScreen() {
  return <LazyScreen feature="home" loader={HOME_LOADER} />;
}
function BookTabScreen() {
  return <LazyScreen feature="book" loader={BOOK_LOADER} />;
}
function AuraTabScreen() {
  return <LazyScreen feature="aura" loader={AURA_LOADER} />;
}
function ProfileTabScreen() {
  return <LazyScreen feature="profile" loader={PROFILE_LOADER} />;
}
function AdminTabScreen() {
  return <LazyScreen feature="admin" loader={ADMIN_LOADER} />;
}

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ focused }: { focused: boolean }) => (
    <View style={tabIconStyles.wrap}>
      {focused ? <View style={tabIconStyles.activeBg} /> : null}
      <Ionicons
        name={name}
        size={focused ? 22 : 21}
        color={focused ? ACCENT : INACTIVE}
      />
      {focused ? <View style={tabIconStyles.activeDot} /> : null}
    </View>
  );
}

function logTabFocus(name: string) {
  console.log(`[nav] tab: ${name}`);
}

export default function HomeTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);

  // useAuth is wrapped in try/catch so even a transient AuthProvider hiccup
  // (token refresh during a re-render, etc.) cannot crash the tab navigator.
  let isPlatformAdmin = false;
  try {
    isPlatformAdmin = Boolean(useAuth().isPlatformAdmin);
  } catch (e) {
    console.warn("[nav] useAuth() failed inside HomeTabs (admin tab hidden):", String(e));
  }

  React.useEffect(() => {
    console.log("[nav] HomeTabs mounted", { isPlatformAdmin, platform: Platform.OS });
  }, [isPlatformAdmin]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: "rgba(245,200,66,0.18)",
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{ tabBarLabel: "Home", tabBarIcon: tabIcon("home") }}
        listeners={{ focus: () => logTabFocus("Home") }}
      />
      <Tab.Screen
        name="Book"
        component={BookTabScreen}
        options={{ tabBarLabel: "Book", tabBarIcon: tabIcon("calendar") }}
        listeners={{ focus: () => logTabFocus("Book") }}
      />
      <Tab.Screen
        name="AURA"
        component={AuraTabScreen}
        options={{ tabBarLabel: "AURA", tabBarIcon: tabIcon("sparkles") }}
        listeners={{ focus: () => logTabFocus("AURA") }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileTabScreen}
        options={{ tabBarLabel: "Profile", tabBarIcon: tabIcon("person") }}
        listeners={{ focus: () => logTabFocus("Profile") }}
      />
      {isPlatformAdmin ? (
        <Tab.Screen
          name="Admin"
          component={AdminTabScreen}
          options={{ tabBarLabel: "Admin", tabBarIcon: tabIcon("shield-checkmark") }}
          listeners={{ focus: () => logTabFocus("Admin") }}
        />
      ) : null}
    </Tab.Navigator>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: { width: 44, height: 32, alignItems: "center", justifyContent: "center" },
  activeBg: {
    position: "absolute",
    top: 2,
    width: 38,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(245,200,66,0.10)",
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.32)",
  },
  activeDot: {
    position: "absolute",
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 4,
    elevation: 4,
  },
});
