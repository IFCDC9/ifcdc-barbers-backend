import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { subscribeConnectionAlerts } from "../services/connectionAlerts";

/**
 * Dismissible banner when backend calls fail (network / 5xx). Never replaces the whole app tree.
 */
export default function ConnectionErrorBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    return subscribeConnectionAlerts(
      () => setVisible(true),
      () => setVisible(false)
    );
  }, []);

  if (!visible) {
    return <View style={{ height: 0, width: "100%" }} collapsable={false} />;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.title}>We can't reach IFCDC right now</Text>
        <Text style={styles.body}>Check your connection or try again shortly.</Text>
        <Pressable onPress={() => setVisible(false)} style={styles.dismiss} accessibilityRole="button">
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1000,
    paddingTop: 52,
    paddingHorizontal: 12,
  },
  banner: {
    backgroundColor: "#2a1810",
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.45)",
    borderRadius: 12,
    padding: 14,
  },
  title: {
    color: "#f5c842",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 6,
  },
  body: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    marginBottom: 10,
  },
  dismiss: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dismissText: {
    color: "#7CFF7A",
    fontWeight: "700",
    fontSize: 14,
  },
});
