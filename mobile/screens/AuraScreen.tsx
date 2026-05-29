import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AuraChatPanel from "../components/AuraChatPanel";
import AppFooter from "../components/AppFooter";
import DarkGradientBackground from "../components/DarkGradientBackground";
import { theme } from "../constants/theme";

const TAB_CLEARANCE = 64;

export default function AuraScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8) + TAB_CLEARANCE;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <DarkGradientBackground />
      <View style={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.chatWrap}>
          <AuraChatPanel />
        </View>
        <AppFooter style={styles.footer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg0 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  chatWrap: { flex: 1 },
  footer: { paddingTop: 8, paddingBottom: 0 },
});
