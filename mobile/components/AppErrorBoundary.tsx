import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log("CRASH:", error?.message, error?.stack);
    console.log("[AppErrorBoundary] componentStack:", errorInfo?.componentStack);
  }

  private clear = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error);
      return (
        <View style={styles.root}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.crashLabel}>Runtime Error:</Text>
            <Text style={styles.crashMessage} selectable>
              {msg}
            </Text>
            <Text style={styles.hint}>Check device logs for full stack (search CRASH).</Text>
            <Pressable style={styles.btn} onPress={this.clear} accessibilityRole="button">
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a0a0a",
    paddingTop: 56,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  crashLabel: {
    color: "red",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  crashMessage: {
    color: "red",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  hint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: "#f5c842",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnText: {
    color: "#050505",
    fontWeight: "700",
    fontSize: 16,
  },
});
