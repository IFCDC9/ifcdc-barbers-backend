/**
 * ApiErrorFallback — crash-safe in-screen UI for API request failures.
 *
 * LazyScreen handles module-load and render-time crashes. ApiErrorFallback
 * is the complementary primitive screens use *inside* their data-fetch
 * code paths: when a network call throws, the screen swaps its content
 * for this card instead of an empty / undefined / blank surface.
 *
 * Use it as a leaf component, not a boundary. Screens own their try/catch
 * around `fetch`/`axios` calls and decide when to render this.
 *
 * Example:
 *
 *   const [state, setState] = React.useState<{ data?: T; error?: string; }>({});
 *
 *   React.useEffect(() => {
 *     fetchSomething()
 *       .then((data) => setState({ data }))
 *       .catch((e) => setState({ error: String(e?.message || e) }));
 *   }, []);
 *
 *   if (state.error) {
 *     return <ApiErrorFallback feature="bookings" message={state.error} onRetry={refetch} />;
 *   }
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Short feature id, e.g. "bookings". Surfaced in logs and the card title. */
  feature: string;
  /** Human-readable error message from the failed call. */
  message: string;
  /** Optional retry callback. If omitted, the retry affordance is hidden. */
  onRetry?: () => void;
  /** Optional extra context (URL, status code) — appears below the message. */
  detail?: string;
  /** Optional compact mode for inline embedding (no scroll, smaller padding). */
  compact?: boolean;
};

export function ApiErrorFallback({
  feature,
  message,
  onRetry,
  detail,
  compact = false,
}: Props) {
  React.useEffect(() => {
    console.warn(`[api] ${feature} fallback rendered:`, message, detail ?? "");
  }, [feature, message, detail]);

  const Body = (
    <View style={[styles.card, compact ? styles.cardCompact : null]}>
      <Text style={styles.brand}>IFCDC</Text>
      <Text style={styles.title}>Couldn't load {feature}</Text>
      <View style={styles.divider} />
      <Text style={styles.message} selectable>
        {message}
      </Text>
      {detail ? (
        <>
          <Text style={styles.label}>Detail</Text>
          <Text style={styles.detail} selectable>
            {detail}
          </Text>
        </>
      ) : null}
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            console.log(`[api] ${feature} retry tapped`);
            onRetry();
          }}
          style={({ pressed }) => [
            styles.retry,
            pressed ? styles.retryPressed : null,
          ]}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (compact) return Body;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {Body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 32, paddingBottom: 64 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(245,200,66,0.28)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  cardCompact: { padding: 14 },
  brand: {
    color: "#F5C842",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 4,
  },
  divider: {
    width: 64,
    height: 1,
    backgroundColor: "rgba(245,200,66,0.45)",
    marginTop: 12,
    marginBottom: 14,
  },
  message: { color: "#fff", fontSize: 13, lineHeight: 19 },
  label: {
    color: "#F5C842",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 4,
  },
  detail: { color: "#a4a4a4", fontSize: 11, lineHeight: 16 },
  retry: {
    alignSelf: "flex-start",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.65)",
    backgroundColor: "rgba(245,200,66,0.08)",
    marginTop: 18,
  },
  retryPressed: { backgroundColor: "rgba(245,200,66,0.18)" },
  retryLabel: {
    color: "#F5C842",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
});

export default ApiErrorFallback;
