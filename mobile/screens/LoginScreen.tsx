import React from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import CardContainer from "../components/CardContainer";
import GlowButton from "../components/GlowButton";
import GoogleButton from "../components/GoogleButton";
import { theme } from "../constants/theme";
import { BACKEND_URL } from "../constants/config";
import { useAuth } from "../services/authContext";
import { EXPO_GO_GOOGLE_PROMPT_OPTIONS } from "../auth/expoGooglePromptOptions";
import { exchangeGoogleIdToken } from "../auth/googleBackendLogin";

/** Google OAuth Web client ID for Expo Go proxy; override with `GOOGLE_EXPO_CLIENT_ID` in env if needed. */
const WEB_CLIENT_ID_FALLBACK =
  "959424837728-du1bihun3s9a353letjrdv4nb34tlsg7.apps.googleusercontent.com";

const GOOGLE_REDIRECT_OPTIONS = {
  useProxy: true,
  projectNameForProxy: "@ifcdc696/ifcdc-barbers-app",
} as const;

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { signInWithToken } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const expoClientId = process.env.GOOGLE_EXPO_CLIENT_ID?.trim() || WEB_CLIENT_ID_FALLBACK;
  const googleConfigured =
    Boolean(expoClientId) && expoClientId.endsWith(".apps.googleusercontent.com");

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      expoClientId,
      scopes: ["openid", "profile", "email"],
    },
    GOOGLE_REDIRECT_OPTIONS
  );

  React.useEffect(() => {
    if (request?.redirectUri) {
      console.log("[auth] redirectUri", request.redirectUri);
    }
    console.log("[auth] Google request ready:", Boolean(request));
  }, [request]);

  React.useEffect(() => {
    if (!response) return;
    const p = (response as any).params || {};
    console.log("[auth] Google response:", response.type, { hasIdToken: Boolean(p.id_token) });

    if (response.type === "error") {
      const err = (response as any).error;
      Alert.alert("Google sign-in", err ? String(err) : "Unknown OAuth error");
      return;
    }

    if (response.type === "dismiss" || response.type === "cancel") {
      return;
    }

    if (response.type !== "success") return;

    const idToken =
      (p.id_token as string | undefined)
      || ((response as any)?.authentication?.idToken as string | undefined);

    if (!idToken) {
      Alert.alert(
        "Google sign-in",
        "No ID token returned. Ensure the Web OAuth client uses OpenID and you are signed in with useIdTokenAuthRequest (implicit id_token flow)."
      );
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        setBusy(true);
        const responseData = await exchangeGoogleIdToken(BACKEND_URL, idToken, ac.signal);
        const response = { data: responseData };
        console.log("GOOGLE RESPONSE:", response.data);

        if (responseData.token) {
          await signInWithToken(responseData.token);
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
        Alert.alert("Google sign-in", e instanceof Error ? e.message : String(e));
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    })();
    return () => ac.abort();
  }, [response, signInWithToken]);

  const startGoogle = async () => {
    try {
      const result = await promptAsync(EXPO_GO_GOOGLE_PROMPT_OPTIONS);
      console.log("[auth] promptAsync done:", result.type);
    } catch (e) {
      console.log("[auth] promptAsync error:", e instanceof Error ? e.message : String(e));
      Alert.alert("Google sign-in", e instanceof Error ? e.message : String(e));
    }
  };

  const login = async () => {
    try {
      setBusy(true);
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = (await res.json()) as { ok?: boolean; token?: string; error?: string };
      if (!res.ok || !json?.ok || !json?.token) throw new Error(json?.error || "login_failed");
      await signInWithToken(json.token);
    } catch (e) {
      Alert.alert("Login", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>IFCDC BARBER</Text>
      <Text style={styles.title}>Sign in</Text>

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
        ) : (
          <>
            <Text style={styles.helper}>Google sign-in is temporarily unavailable.</Text>
            <View style={{ height: 12 }} />
          </>
        )}

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
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.45)"
          secureTextEntry
          style={styles.input}
          editable={!busy}
        />
        <View style={{ height: 12 }} />
        <GlowButton label="Sign in" onPress={login} disabled={busy} loading={busy} />

        <View style={{ height: 12 }} />
        <GlowButton label="Create account" onPress={() => navigation.navigate("Register")} variant="outline" disabled={busy} />
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
