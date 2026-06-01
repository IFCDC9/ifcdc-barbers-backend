/**
 * LazyScreen — the screen-level isolation primitive for Build 23+.
 *
 * Every feature surface in the app (Home, Book, AURA, Profile, Admin, etc.)
 * is mounted through a LazyScreen. Its job is to make sure that no single
 * feature module can crash the rest of the app, regardless of whether the
 * crash happens at module-load time, first-render time, or later during
 * a re-render.
 *
 * Boundaries provided by LazyScreen, in layered order:
 *
 *   1. Module-load isolation: the underlying screen is `require()`-d inside
 *      a try/catch on mount (deferred one tick so the placeholder paints
 *      first). A throw at JS evaluation — the suspected cause of the
 *      Build 18-20 black screens — is caught and surfaced as a labelled
 *      "Feature unavailable" card. App.tsx's TopBoundary cannot catch
 *      module-load errors; this layer can, because the require() call is
 *      deferred to the React event loop.
 *
 *   2. Render-error isolation: a class-component ErrorBoundary wraps the
 *      mounted screen. Render-time throws produce a labelled recovery card
 *      with a "Try again" affordance instead of unmounting the navigator.
 *
 *   3. SafeAreaView: every LazyScreen-wrapped surface gets edge-aware
 *      padding so iOS notch / Dynamic Island / home indicator never clip
 *      content, and Android gesture nav doesn't overlap interactive UI.
 *
 *   4. Visible loading state: an ActivityIndicator + label paints during
 *      the brief deferred-require window, so the user never sees a blank
 *      surface — Build 22's stable-shell rule.
 *
 * Ground rules for callers:
 *
 *   - `loader` MUST be a stable function reference declared at module scope
 *     or memoised via `React.useCallback`. An inline `() => require(...)`
 *     in JSX would re-instantiate every render and re-trigger the effect.
 *
 *   - `feature` is a short stable identifier ("home", "book", "aura"…)
 *     used in console logs and the recovery UI. Keep it short and stable;
 *     it is what the support team reads off the recovery screen.
 *
 *   - LazyScreen renders `<IFCDCFooter compact />` globally for every loaded
 *     tab so individual screen files do not import the footer themselves.
 *
 *   - LazyScreen does NOT inject providers. Providers live above it in
 *     AppRoot (SafeAreaProvider, AuthProvider, NavigationContainer). This
 *     keeps the contract simple: a LazyScreen is just a screen.
 */

import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type LazyLoader = () => unknown;

export type LazyScreenProps<P extends object = Record<string, never>> = {
  /** Short stable feature id, e.g. "home". Surfaced in logs and recovery UI. */
  feature: string;
  /**
   * Synchronous CommonJS-style loader. Returns the module — typically `() => require("../path/to/Screen")`.
   * Must be a stable reference (declared at module scope or memoised).
   */
  loader: LazyLoader;
  /** Optional props forwarded to the underlying screen component. */
  componentProps?: P;
  /** Optional override for the loading-state background (defaults to brand black). */
  background?: string;
  /** Optional callback fired on successful mount of the underlying screen. */
  onMounted?: () => void;
};

type Phase =
  | { kind: "loading" }
  | { kind: "loaded"; Component: React.ComponentType<unknown> }
  | { kind: "error"; message: string; stack?: string; stage: "module-load" | "render" };

class ScreenErrorBoundary extends React.Component<
  {
    feature: string;
    onError: (error: Error) => void;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[screen] render error in "${this.props.feature}":`,
      error?.message,
      info?.componentStack ?? "",
    );
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function LazyScreen<P extends object = Record<string, never>>(
  props: LazyScreenProps<P>,
) {
  const { feature, loader, componentProps, background, onMounted } = props;
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const mod = loader() as { default?: unknown } | unknown;
        const Component =
          (mod && typeof mod === "object" && (mod as { default?: unknown }).default) ||
          mod;
        if (typeof Component !== "function") {
          throw new Error(
            `Lazy loader for "${feature}" did not return a React component (got ${typeof Component}).`,
          );
        }
        console.log(`[screen] mounted: ${feature}`);
        setPhase({ kind: "loaded", Component: Component as React.ComponentType<unknown> });
        onMounted?.();
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error(`[screen] module-load FAILED for "${feature}":`, err.message);
        setPhase({
          kind: "error",
          message: err.message,
          stack: err.stack,
          stage: "module-load",
        });
      }
    }, 16);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [feature, loader, attempt, onMounted]);

  const onRetry = React.useCallback(() => {
    console.log(`[screen] retry: ${feature}`);
    setPhase({ kind: "loading" });
    setAttempt((a) => a + 1);
  }, [feature]);

  const onRenderError = React.useCallback(
    (e: Error) => {
      setPhase({
        kind: "error",
        message: e?.message || String(e),
        stack: e?.stack,
        stage: "render",
      });
    },
    [],
  );

  const rootStyle = React.useMemo(
    () => [styles.root, background ? { backgroundColor: background } : null],
    [background],
  );

  if (phase.kind === "loading") {
    return (
      <SafeAreaView style={rootStyle} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#F5C842" />
          <View style={{ height: 12 }} />
          <Text style={styles.loadingLabel}>{`Loading ${feature}…`}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === "error") {
    return (
      <FeatureUnavailable
        feature={feature}
        message={phase.message}
        stack={phase.stack}
        stage={phase.stage}
        onRetry={onRetry}
      />
    );
  }

  const { Component } = phase;
  return (
    <SafeAreaView style={rootStyle} edges={["top", "left", "right"]}>
      <ScreenErrorBoundary feature={feature} onError={onRenderError}>
        <View style={styles.shell}>
          <View style={styles.flex}>
            <Component {...((componentProps ?? {}) as object)} />
          </View>
        </View>
      </ScreenErrorBoundary>
    </SafeAreaView>
  );
}

function FeatureUnavailable({
  feature,
  message,
  stack,
  stage,
  onRetry,
}: {
  feature: string;
  message: string;
  stack?: string;
  stage: "module-load" | "render";
  onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.errScroll}>
        <Text style={styles.errBrand}>IFCDC Barbers</Text>
        <Text style={styles.errTitle}>Feature unavailable</Text>
        <View style={styles.divider} />

        <Text style={styles.errLabel}>Feature</Text>
        <Text style={styles.errBody} selectable>
          {feature}
        </Text>

        <Text style={styles.errLabel}>Failed at</Text>
        <Text style={styles.errBody} selectable>
          {stage}
        </Text>

        <Text style={styles.errLabel}>Error</Text>
        <Text style={styles.errBody} selectable>
          {message}
        </Text>

        {stack ? (
          <>
            <Text style={styles.errLabel}>Details</Text>
            <Text style={styles.errBodyDim} selectable>
              {stack}
            </Text>
          </>
        ) : null}

        <Text style={styles.errLabel}>Platform</Text>
        <Text style={styles.errBody} selectable>
          {Platform.OS} {String(Platform.Version)}
        </Text>

        <View style={{ height: 24 }} />
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed ? styles.retryButtonPressed : null,
          ]}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>

        <Text style={styles.errHint}>
          The rest of the app is still working. Use the tab bar to continue, or
          send this screen to support so we can patch this feature.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0b" },
  shell: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingLabel: { color: "#bdbdbd", fontSize: 12, letterSpacing: 0.4, fontWeight: "600" },
  errScroll: { padding: 24, paddingTop: 32, paddingBottom: 64 },
  errBrand: {
    color: "#F5C842",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.6,
    textAlign: "center",
  },
  errTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
    marginTop: 6,
  },
  divider: {
    width: 96,
    height: 1,
    backgroundColor: "rgba(245,200,66,0.45)",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 18,
  },
  errLabel: {
    color: "#F5C842",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 4,
  },
  errBody: { color: "#fff", fontSize: 13, lineHeight: 19 },
  errBodyDim: { color: "#a4a4a4", fontSize: 11, lineHeight: 16 },
  retryButton: {
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.65)",
    backgroundColor: "rgba(245,200,66,0.08)",
  },
  retryButtonPressed: { backgroundColor: "rgba(245,200,66,0.18)" },
  retryLabel: {
    color: "#F5C842",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  errHint: {
    color: "#888",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 24,
  },
});

export default LazyScreen;
