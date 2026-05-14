import React from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import CardContainer from "../components/CardContainer";
import GlowButton from "../components/GlowButton";
import GoogleButton from "../components/GoogleButton";
import { theme } from "../constants/theme";
import { BACKEND_URL, apiFullUrl } from "../constants/config";
import { useAuth } from "../services/authContext";
import { EXPO_GO_GOOGLE_PROMPT_OPTIONS } from "../auth/expoGooglePromptOptions";
import { getGoogleIdTokenAuthConfig } from "../auth/googleAuthRequestConfig";
import { exchangeGoogleIdToken } from "../auth/googleBackendLogin";
import { registerWithEmailPassword } from "../auth/authSessionApi";

const GOOGLE_REDIRECT_OPTIONS = {
  useProxy: true,
  projectNameForProxy: "@ifcdc696/ifcdc-barbers-app",
} as const;

export default function RegisterScreen({ navigation }: { navigation: any }) {
  React.useEffect(() => {
    console.log("[register] API base:", BACKEND_URL, "register URL:", apiFullUrl("/api/auth/register"));
  }, []);
  const { signInWithToken } = useAuth();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [accountType, setAccountType] = React.useState<"customer" | "barber">("customer");
  const [busy, setBusy] = React.useState(false);

  const googleAuthConfig = React.useMemo(() => getGoogleIdTokenAuthConfig(), []);
  const googleConfigured = Boolean(
    googleAuthConfig.webClientId?.endsWith(".apps.googleusercontent.com")
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    googleAuthConfig,
    GOOGLE_REDIRECT_OPTIONS
  );

  React.useEffect(() => {
    if (request?.redirectUri) {
      console.log("[auth] redirectUri", request.redirectUri);
    }
    console.log("[auth] Google request ready:", Boolean(request));
  }, [request]);

  React.useEffect(() => {
    if (!response) return undefined;

    try {
      const p = (response as any).params || {};
      console.log("[auth] Google response:", response.type, { hasIdToken: Boolean(p.id_token) });

      if (response.type === "error") {
        const err = (response as any).error;
        Alert.alert("Google sign-in", err ? String(err) : "Unknown OAuth error");
        return undefined;
      }

      if (response.type === "dismiss" || response.type === "cancel") {
        return undefined;
      }

      if (response.type !== "success") return undefined;

      const idToken =
        (p.id_token as string | undefined)
        || ((response as any)?.authentication?.idToken as string | undefined);

      if (!idToken) {
        Alert.alert(
          "Google sign-in",
          "No ID token returned. Ensure the Web OAuth client uses OpenID and you are signed in with useIdTokenAuthRequest (implicit id_token flow)."
        );
        return undefined;
      }

      const ac = new AbortController();
      (async () => {
        try {
          setBusy(true);
          const responseData = await exchangeGoogleIdToken(BACKEND_URL, idToken, ac.signal);
          const wrapped = { data: responseData };
          console.log("GOOGLE RESPONSE:", wrapped.data);

          if (responseData.token) {
            try {
              const u = responseData.user;
              console.log("[auth] client_google_register", {
                email: u?.email,
                role: u?.role,
                redirect: responseData.redirect,
              });
              await signInWithToken(responseData.token);
            } catch (saveErr) {
              Alert.alert(
                "Could not save session",
                saveErr instanceof Error ? saveErr.message : "Token save failed.",
              );
            }
            return;
          }

          if (responseData.user) {
            Alert.alert(
              "Google sign-in",
              "Google verified your account, but the server did not return a JWT. Ensure POST /api/auth/google responds with a `token` field so the app can stay signed in."
            );
            return;
          }

          Alert.alert("Google sign-in", "Unexpected server response after Google sign-in.");
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          console.log("[register] Google exchange failed:", e instanceof Error ? e.message : String(e));
          Alert.alert("Google sign-in", e instanceof Error ? e.message : String(e));
        } finally {
          if (!ac.signal.aborted) setBusy(false);
        }
      })();
      return () => ac.abort();
    } catch (e) {
      console.log("[register] Google response handler error:", e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }, [response, signInWithToken]);

  const startGoogle = async () => {
    if (!googleConfigured) {
      Alert.alert("Google sign-in", "Google OAuth config missing on this build.");
      return;
    }
    if (!request) {
      Alert.alert("Google sign-in", "Google is still initializing. Wait a moment and try again.");
      return;
    }
    try {
      const result = await promptAsync(EXPO_GO_GOOGLE_PROMPT_OPTIONS);
      console.log("[auth] promptAsync done:", result.type);
    } catch (e) {
      console.log("[auth] promptAsync error:", e instanceof Error ? e.message : String(e));
      Alert.alert("Google sign-in", e instanceof Error ? e.message : String(e));
    }
  };

  const register = async () => {
    try {
      setBusy(true);
      const { token, json } = await registerWithEmailPassword(
        fullName.trim(),
        email.trim(),
        password,
        accountType,
      );
      const u = json?.user;
      console.log("[auth] client_register", {
        email: u?.email,
        role: u?.role,
        redirect: json?.redirect,
      });
      try {
        await signInWithToken(token);
      } catch (saveErr) {
        Alert.alert(
          "Could not save session",
          saveErr instanceof Error ? saveErr.message : "Token save failed.",
        );
      }
    } catch (e) {
      Alert.alert("Create account", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>IFCDC BARBER</Text>
      <Text style={styles.title}>Create account</Text>

      <CardContainer glow style={{ width: "100%" }}>
        {googleConfigured && request ? (
          <>
            <GoogleButton onPress={startGoogle} disabled={!request || busy} />
            <View style={{ height: 8 }} />
            <Button title="Continue with Google" onPress={startGoogle} disabled={!request || busy} />
            <View style={{ height: 12 }} />
            <Text style={styles.or}>or</Text>
            <View style={{ height: 12 }} />
          </>
        ) : googleConfigured ? (
          <>
            <Text style={styles.helper}>Preparing Google sign-in…</Text>
            <View style={{ height: 12 }} />
          </>
        ) : (
          <>
            <Text style={styles.helper}>
              Google OAuth config missing: set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and backend GOOGLE_CLIENT_ID.
            </Text>
            <View style={{ height: 12 }} />
          </>
        )}

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="rgba(255,255,255,0.45)"
          style={styles.input}
          editable={!busy}
        />
        <View style={{ height: 10 }} />
        <Text style={styles.helper}>Account type</Text>
        <View style={{ height: 8 }} />
        <View style={styles.roleRow}>
          <View style={{ flex: 1 }}>
            <GlowButton
              label="Customer"
              onPress={() => setAccountType("customer")}
              variant={accountType === "customer" ? "primary" : "outline"}
              disabled={busy}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <GlowButton
              label="Barber"
              onPress={() => setAccountType("barber")}
              variant={accountType === "barber" ? "primary" : "outline"}
              disabled={busy}
            />
          </View>
        </View>
        <View style={{ height: 10 }} />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.45)"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          editable={!busy}
        />
        <View style={{ height: 10 }} />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min 12: upper, lower, number, symbol)"
          placeholderTextColor="rgba(255,255,255,0.45)"
          secureTextEntry
          style={styles.input}
          editable={!busy}
        />
        <View style={{ height: 12 }} />
        <GlowButton label="Create account" onPress={register} disabled={busy} loading={busy} />

        <View style={{ height: 12 }} />
        <GlowButton label="Back to sign in" onPress={() => navigation.navigate("Login")} variant="outline" disabled={busy} />
      </CardContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  brand: { color: theme.colors.gold, fontWeight: "900", fontSize: 18, letterSpacing: 1.6 },
  title: { color: theme.colors.text, fontWeight: "900", fontSize: 26, marginBottom: 8 },
  helper: { color: theme.colors.textMuted, textAlign: "center", fontSize: 12 },
  or: { color: theme.colors.textMuted, textAlign: "center", fontWeight: "700" },
  roleRow: { flexDirection: "row", width: "100%", justifyContent: "center", alignItems: "stretch" },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
});
