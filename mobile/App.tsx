/**
 * IFCDC Barbers — BUILD 21 EMERGENCY FALLBACK SMOKE TEST.
 *
 * Build 18 (white screen) was fixed by removing the stale App.js / index.js
 * entry. Build 19 was a duplicate of the old IPA. Build 20 stayed dark
 * because the dark loading gate hid the real navigator. Build 20 ALSO did
 * not show the gold diagnostic banner that was added at the root of the
 * provider tree — which proves React itself never mounted, i.e. a top-level
 * import or side-effect inside the previous App.tsx (AuthProvider, i18n
 * synchronous init, expo-auth-session, expo-notifications, the legal-screen
 * chain, the Tabs layout, etc.) is throwing at module-load time. The
 * StartupErrorBoundary cannot catch module-load errors — it only catches
 * errors during render — so the user only ever sees a black surface.
 *
 * This file is intentionally the ABSOLUTE MINIMUM React app on purpose:
 *   - Only `react` and `react-native` core imports. Nothing else.
 *   - No SafeAreaProvider, no NavigationContainer, no Stack/Tabs, no auth
 *     context, no i18n, no notifications, no Google auth, no legal screens.
 *   - No async work, no useEffect, no state — just static JSX.
 *
 * If Build 21 displays "IFCDC ROOT LOADED BUILD 21" on a fresh TestFlight
 * install, we've proven: (a) the native shell is healthy, (b) the JS bundle
 * loads, (c) React mounts, (d) the entry chain (AppEntry.js → App.tsx) is
 * intact. The next builds will then progressively re-add real layers
 * (SafeAreaProvider → AuthProvider → i18n → LoginScreen → ...) until the
 * crashing import is identified.
 *
 * If Build 21 STILL shows a black screen on a fresh install, the problem is
 * below JavaScript (cached IPA on the device, wrong artifact uploaded to
 * Apple, native module misconfiguration). The handoff doc tells you how to
 * confirm device cache vs. real ship issue.
 */

import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const BUILD_LABEL = "BUILD 21";

console.log("[startup] App.tsx (minimal) module loaded", {
  buildLabel: BUILD_LABEL,
  platform: Platform.OS,
  version: String(Platform.Version),
  ts: new Date().toISOString(),
});

export default function App() {
  console.log("[startup] App() render");
  return (
    <View style={styles.root}>
      <Text style={styles.title}>IFCDC ROOT LOADED {BUILD_LABEL}</Text>
      <Text style={styles.subtitle}>React mounted successfully</Text>
      <View style={styles.divider} />
      <Text style={styles.info}>
        {Platform.OS} {String(Platform.Version)}
      </Text>
      <Text style={styles.info}>{new Date().toISOString()}</Text>
      <Text style={styles.hint}>
        If you can read this, the entry chain is healthy. The next build will
        re-enable the real login flow on top of this foundation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#F5C842",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  subtitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  divider: {
    width: 120,
    height: 1,
    backgroundColor: "rgba(245,200,66,0.45)",
    marginVertical: 22,
  },
  info: {
    color: "#bdbdbd",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  hint: {
    color: "#777",
    fontSize: 11,
    marginTop: 28,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 320,
  },
});
