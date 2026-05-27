import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { theme } from "../constants/theme";
import GlowButton from "./GlowButton";
import ProfileCard from "./ProfileCard";
import {
  sendAuraChatMessage,
  type AuraChatMessage,
  AURA_RECONNECT_MESSAGE,
} from "../services/auraChatApi";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** Embedded text-only AURA chat (no modal, no voice). */
export default function AuraChatPanel() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [conversationId] = useState(() => `ai-${Date.now()}`);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailedUserText, setLastFailedUserText] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glow]);

  const haloOpacity = glow.interpolate({
    inputRange: [0.35, 1],
    outputRange: [0.14, 0.32],
  });
  const haloScale = glow.interpolate({
    inputRange: [0.35, 1],
    outputRange: [1, 1.12],
  });

  const suggestionKeys = useMemo(
    () =>
      [
        "aura.promptBooking",
        "aura.promptServices",
        "aura.promptPayments",
        "aura.promptPolicies",
        "aura.promptHours",
      ] as const,
    [],
  );

  const data = useMemo(() => messages, [messages]);
  const canSend = text.trim().length > 0 && !sending;

  const scrollToLatest = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const postMessage = async (trimmed: string) => {
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const nextThread: AuraChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setLastFailedUserText(null);
    scrollToLatest();

    console.log("[aura] send:", trimmed.slice(0, 80));

    const { reply } = await sendAuraChatMessage({
      message: trimmed,
      conversationId,
      messages: nextThread,
    });

    const failed =
      !reply ||
      reply === AURA_RECONNECT_MESSAGE ||
      reply === t("aura.reconnecting");

    if (failed) {
      console.warn("[aura] reply unavailable — show retry");
      setLastFailedUserText(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          content: t("aura.reconnecting"),
        },
      ]);
    } else {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    }

    setSending(false);
    scrollToLatest();
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    await postMessage(trimmed);
  };

  const sendSuggestion = (key: (typeof suggestionKeys)[number]) => {
    const q = t(key);
    if (!q || sending) return;
    void postMessage(q);
  };

  const retryLast = () => {
    if (!lastFailedUserText || sending) return;
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length && copy[copy.length - 1]?.role === "assistant") copy.pop();
      if (copy.length && copy[copy.length - 1]?.content === lastFailedUserText) copy.pop();
      return copy;
    });
    void postMessage(lastFailedUserText);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>{item.content}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 64 : 0}
    >
      <View style={styles.header}>
        <View style={styles.orbWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orbHalo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />
          <View style={styles.orb}>
            <View pointerEvents="none" style={styles.orbInnerRing} />
            <Text style={styles.orbLabel}>AURA</Text>
          </View>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("aura.title")}</Text>
          <Text style={styles.subtitle}>{t("aura.tagline")}</Text>
        </View>
      </View>

      <ProfileCard style={styles.chatCard}>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.welcomeBox}>
              <Text style={styles.welcomeTitle}>{t("aura.title")}</Text>
              <Text style={styles.emptyHint}>{t("aura.emptyHistory")}</Text>
            </View>
          }
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={theme.colors.gold} />
                <Text style={styles.typingText}>{t("aura.sending")}</Text>
              </View>
            ) : null
          }
          onContentSizeChange={scrollToLatest}
        />

        {lastFailedUserText ? (
          <GlowButton
            label={t("common.tryAgain")}
            variant="outline"
            onPress={retryLast}
            disabled={sending}
            style={styles.retryBtn}
          />
        ) : null}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 4) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("aura.placeholder")}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <GlowButton label={t("aura.send")} onPress={send} disabled={!canSend} loading={sending} />
        </View>
      </ProfileCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  orbWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHalo: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(245,200,66,0.16)",
  },
  orb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGold,
    alignItems: "center",
    justifyContent: "center",
  },
  orbInnerRing: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.36)",
  },
  orbLabel: {
    color: theme.colors.gold,
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  headerText: { flex: 1 },
  title: { color: theme.colors.text, fontWeight: "900", fontSize: 20 },
  subtitle: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
  chatCard: { flex: 1, padding: 14, minHeight: 280 },
  list: { gap: 10, paddingVertical: 4, paddingBottom: 8, flexGrow: 1 },
  welcomeBox: { gap: 8, paddingVertical: 8 },
  welcomeTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: "800" },
  emptyHint: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
  welcomeFoot: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  suggestionRow: { gap: 8, paddingTop: 10, paddingRight: 8 },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.35)",
    backgroundColor: "rgba(245,200,66,0.08)",
  },
  suggestionChipPressed: { backgroundColor: "rgba(245,200,66,0.16)" },
  suggestionText: { color: theme.colors.gold, fontSize: 12, fontWeight: "700" },
  retryBtn: { marginTop: 8, alignSelf: "flex-start" },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  typingText: { color: theme.colors.textMuted, fontSize: 13 },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.gold,
    borderColor: "rgba(245,200,66,0.65)",
    borderTopRightRadius: 4,
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleAi: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(245,200,66,0.18)",
    borderTopLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: "#111", fontWeight: "700" },
  aiText: { color: theme.colors.text, fontWeight: "600" },
  composer: { marginTop: 10, gap: 10 },
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
