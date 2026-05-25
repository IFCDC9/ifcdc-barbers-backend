import React from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import { useTranslation } from "react-i18next";
import CardContainer from "../components/CardContainer";
import GlowButton from "../components/GlowButton";
import GoogleButton from "../components/GoogleButton";
import { theme } from "../constants/theme";
import { BACKEND_URL, apiFullUrl } from "../constants/config";
import { useAuth } from "../services/authContext";
import { EXPO_GO_GOOGLE_PROMPT_OPTIONS } from "../auth/expoGooglePromptOptions";
import { getGoogleIdTokenAuthConfig } from "../auth/googleAuthRequestConfig";
import { exchangeGoogleIdToken } from "../auth/googleBackendLogin";
import { loginWithEmailPassword } from "../auth/authSessionApi";
import { userFacingApiError } from "../utils/userFacingApiError";
import { UX } from "../utils/uxCopy";

const GOOGLE_REDIRECT_OPTIONS = {
  useProxy: true,
  projectNameForProxy: "@ifcdc696/ifcdc-barbers-app",
} as const;

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  React.useEffect(() => {
    console.log("[login] API base:", BACKEND_URL, "login URL:", apiFullUrl("/api/auth/login"));
  }, []);

  const { signInWithToken } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submittingRef = React.useRef(false);

  const googleAuthConfig = React.useMemo(() => getGoogleIdTokenAuthConfig(), []);
  const googleConfigured = Boolean(
    googleAuthConfig.webClientId?.endsWith(".apps.googleusercontent.com")
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    googleAuthConfig,
    GOOGLE_REDIRECT_OPTIONS
  );

  React.useEffect(() => {
    try {
      if (request?.redirectUri) {
        console.log("[auth] redirectUri", request.redirectUri);
      }
      console.log("[auth] Google request ready:", Boolean(request));
    } catch (e) {
      console.log("CRASH:", e);
    }
  }, [request]);

  React.useEffect(() => {
    if (!response) return undefined;

    try {
      const p = (response as any).params || {};
      console.log("[auth] Google response:", response.type, { hasIdToken: Boolean(p.id_token) });

      if (response.type === "error") {
        Alert.alert("Google sign-in", "Google sign-in could not be completed. Please try again.");
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
        Alert.alert("Google sign-in", "Google sign-in could not be completed. Please try again.");
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
              console.log("[auth] client_google_login", {
                email: u?.email,
                role: u?.role,
                redirect: responseData.redirect,
              });
              await signInWithToken(responseData.token);
            } catch (saveErr) {
              Alert.alert("Session", userFacingApiError(saveErr));
            }
            return;
          }

          if (responseData.user) {
            Alert.alert("Google sign-in", "Sign-in could not be completed. Please try again or use email.");
            return;
          }

          Alert.alert("Google sign-in", "Sign-in could not be completed. Please try again.");
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          console.log("CRASH:", e);
          console.log("[login] Google exchange failed:", e instanceof Error ? e.message : String(e));
          Alert.alert("Google sign-in", userFacingApiError(e));
        } finally {
          if (!ac.signal.aborted) setBusy(false);
        }
      })();
      return () => ac.abort();
    } catch (e) {
      console.log("CRASH:", e);
      console.log("[login] Google response handler error:", e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }, [response, signInWithToken]);

  const startGoogle = async () => {
    if (!googleConfigured) {
      Alert.alert("Google sign-in", UX.googleSignInUnavailable);
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
      Alert.alert("Google sign-in", userFacingApiError(e));
    }
  };

  const login = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      setBusy(true);
      const { token, json } = await loginWithEmailPassword(email.trim(), password);
      const u = json?.user;
      console.log("[auth] client_login", {
        email: u?.email,
        role: u?.role,
        isOwner: u?.isOwner,
        isSuperAdmin: u?.isSuperAdmin,
        redirect: json?.redirect,
      });
      try {
        await signInWithToken(token);
      } catch (saveErr) {
        Alert.alert("Session", userFacingApiError(saveErr));
      }
    } catch (e) {
      Alert.alert("Sign in", userFacingApiError(e));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.glowOrb} />
      <Text style={styles.brand}>IFCDC BARBER</Text>
      <View style={styles.brandUnderline} />
      <Text style={styles.title}>{t("auth.signInTitle")}</Text>
      <Text style={styles.tagline}>{t("auth.signInTagline")}</Text>

      <CardContainer glow style={{ width: "100%" }}>
        {googleConfigured && request ? (
          <>
            <GoogleButton onPress={startGoogle} disabled={!request || busy} />
            <View style={{ height: 12 }} />
            <Text style={styles.or}>{t("auth.or")}</Text>
            <View style={{ height: 12 }} />
          </>
        ) : googleConfigured ? (
          <>
            <Text style={styles.helper}>Preparing Google sign-in…</Text>
            <View style={{ height: 12 }} />
          </>
        ) : (
          <>
            <Text style={styles.helper}>{UX.googleSignInUnavailable}</Text>
            <View style={{ height: 12 }} />
          </>
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t("auth.email")}
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
          placeholder={t("auth.password")}
          placeholderTextColor="rgba(255,255,255,0.45)"
          secureTextEntry
          style={styles.input}
          editable={!busy}
        />
        <View style={{ height: 12 }} />
        <GlowButton label={t("auth.signInBtn")} onPress={login} disabled={busy} loading={busy} />

        <View style={{ height: 12 }} />
        <GlowButton
          label={t("auth.signUpBtn")}
          onPress={() => navigation.navigate("Register")}
          variant="outline"
          disabled={busy}
        />
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
    gap: 6,
  },
  glowOrb: {
    position: "absolute",
    top: -120,
    left: "50%",
    marginLeft: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(245,200,66,0.06)",
  },
  brand: { color: theme.colors.gold, fontWeight: "900", fontSize: 18, letterSpacing: 1.8 },
  brandUnderline: {
    width: 28,
    height: 2,
    borderRadius: 2,
    backgroundColor: theme.colors.goldSoft,
    marginTop: 4,
    marginBottom: 6,
  },
  title: { color: theme.colors.text, fontWeight: "900", fontSize: 28, marginTop: 4 },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: 12.5,
    marginBottom: 14,
    letterSpacing: 0.4,
  },
  helper: { color: theme.colors.textMuted, textAlign: "center", fontSize: 12 },
  or: { color: theme.colors.textMuted, textAlign: "center", fontWeight: "700", letterSpacing: 1.6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 14.5,
  },
});
