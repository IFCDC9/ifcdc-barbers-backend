import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { UX } from "../utils/uxCopy";
import { theme } from "../constants/theme";

export function ScreenLoading({ label = UX.loading }: { label?: string }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={theme.colors.gold} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ScreenEmpty({ message = UX.emptyRecords }: { message?: string }) {
  return (
    <ProfileCard>
      <Text style={styles.empty}>{message}</Text>
    </ProfileCard>
  );
}

export function ScreenError({ message }: { message: string }) {
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  loadingWrap: { alignItems: "center", gap: 10, marginTop: 28, marginBottom: 8 },
  loadingText: { color: theme.colors.textMuted, fontSize: 14 },
  empty: { color: theme.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  error: { color: "#f87171", fontSize: 14, lineHeight: 20, marginTop: 12 },
});
