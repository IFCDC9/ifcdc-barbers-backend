/**
 * PasswordResetScreen — Build 22 minimal placeholder.
 *
 * Build 22 reintegration only re-enables Login / Register / Password Reset /
 * Dashboard shell. The customer-facing password reset endpoint isn't wired
 * to the backend yet — `mobile/services/adminPasswordResetApi.ts` exists but
 * is admin-only. Until the public endpoint lands, this screen takes an email
 * and shows the standard neutral confirmation regardless of whether an
 * account exists, so we never leak which addresses are registered.
 *
 * Intentional design choices:
 *   - Imports ONLY `react` + `react-native` core (no theme, no shared
 *     components) so the module-load cost is near zero — the same constraint
 *     Build 21 proved is safe.
 *   - `useTranslation()` is intentionally NOT used here so this screen still
 *     renders even if i18n init fails later. The text is fixed English; the
 *     i18n-aware customer flow can replace this in a later build.
 */

import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import IFCDCFooter from "../components/IFCDCFooter";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  navigation: { goBack: () => void };
};

export default function PasswordResetScreen({ navigation }: Props) {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const onSubmit = React.useCallback(() => {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      Alert.alert(
        "Reset password",
        "Please enter a valid email address.",
      );
      return;
    }
    setBusy(true);
    // Same neutral message regardless of account existence — avoids leaking
    // which emails are registered. Real backend wiring lands in a future build.
    setTimeout(() => {
      setBusy(false);
      Alert.alert(
        "Reset password",
        "If an account exists for that email, a password reset link is on the way.",
      );
    }, 350);
  }, [email]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we'll send a link to set a new password.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#666"
          style={styles.input}
          editable={!busy}
        />

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={({ pressed }) => [
            styles.primary,
            busy ? styles.primaryDisabled : null,
            pressed && !busy ? styles.primaryPressed : null,
          ]}
        >
          <Text style={styles.primaryText}>
            {busy ? "Sending…" : "Send reset link"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.secondary, pressed ? styles.secondaryPressed : null]}
        >
          <Text style={styles.secondaryText}>Back to sign in</Text>
        </Pressable>
      </View>
      <IFCDCFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    padding: 24,
    paddingTop: 88,
    alignItems: "center",
  },
  title: {
    color: "#F5C842",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  subtitle: {
    color: "#bdbdbd",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 18,
    marginBottom: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(245,200,66,0.04)",
    borderColor: "rgba(245,200,66,0.32)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  label: {
    color: "#F5C842",
    fontSize: 11,
    letterSpacing: 1.0,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#000",
    borderColor: "rgba(245,200,66,0.35)",
    borderWidth: 1,
    borderRadius: 8,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 18,
  },
  primary: {
    backgroundColor: "#F5C842",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#0b0b0b",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  secondary: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  secondaryText: {
    color: "#F5C842",
    fontSize: 13,
    fontWeight: "700",
  },
});
