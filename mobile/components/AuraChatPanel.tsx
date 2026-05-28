import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { palette, radius, shadow, theme, typography } from "../constants/theme";
import GlowButton from "./GlowButton";
import ProfileCard from "./ProfileCard";
import TextChip from "./TextChip";
import { useAuth } from "../services/authContext";
import {
  sendAuraChatMessage,
  type AuraChatMessage,
  AURA_RECONNECT_MESSAGE,
} from "../services/auraChatApi";
import {
  clearAuraChatMessages,
  loadAuraChatMessages,
  saveAuraChatMessages,
  type StoredAuraMessage,
} from "../services/auraChatStore";
import {
  clearAuraConversationOnServer,
  deleteAuraMessageOnServer,
} from "../services/auraChatHistoryApi";
import { confirmDelete } from "../utils/confirmDelete";

type Msg = StoredAuraMessage;

function TypingDots() {
  const a = useRef(new Animated.Value(0.35)).current;
  const b = useRef(new Animated.Value(0.35)).current;
  const c = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 380, useNativeDriver: true }),
        ]),
      );
    const loops = [pulse(a, 0), pulse(b, 140), pulse(c, 280)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b, c]);

  return (
    <View style={typingStyles.row}>
      {[a, b, c].map((v, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { opacity: v, transform: [{ scale: v }] }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.gold,
  },
});

/** Embedded text-only AURA chat (no modal, no voice). */
export default function AuraChatPanel() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const [conversationId] = useState(() => `ai-${Date.now()}`);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailedUserText, setLastFailedUserText] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const glow = useRef(new Animated.Value(0.35)).current;

  const persistMessages = useCallback(
    async (next: Msg[]) => {
      await saveAuraChatMessages(userId, next);
    },
    [userId],
  );

  useEffect(() => {
    void loadAuraChatMessages(userId).then((stored) => {
      if (stored.length) setMessages(stored);
    });
  }, [userId]);

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

  const data = useMemo(() => messages, [messages]);
  const canSend = text.trim().length > 0 && !sending;

  const scrollToLatest = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const applyMessages = useCallback(
    (updater: (prev: Msg[]) => Msg[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        void persistMessages(next);
        return next;
      });
    },
    [persistMessages],
  );

  const postMessage = async (trimmed: string) => {
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const nextThread: AuraChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    applyMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setLastFailedUserText(null);
    scrollToLatest();

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
      setLastFailedUserText(trimmed);
      applyMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          content: t("aura.reconnecting"),
        },
      ]);
    } else {
      applyMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
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

  const retryLast = () => {
    if (!lastFailedUserText || sending) return;
    applyMessages((prev) => {
      const copy = [...prev];
      if (copy.length && copy[copy.length - 1]?.role === "assistant") copy.pop();
      if (copy.length && copy[copy.length - 1]?.content === lastFailedUserText) copy.pop();
      return copy;
    });
    void postMessage(lastFailedUserText);
  };

  const deleteMessage = (id: string) => {
    void (async () => {
      if (!(await confirmDelete())) return;
      applyMessages((prev) => prev.filter((m) => m.id !== id));
      if (userId && !id.startsWith("u-") && !id.startsWith("a-")) {
        try {
          await deleteAuraMessageOnServer(id);
        } catch {
          // Local-only ids are fine without server sync.
        }
      }
    })();
  };

  const clearConversation = () => {
    Alert.alert("Clear conversation", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setMessages([]);
            setLastFailedUserText(null);
            await clearAuraChatMessages(userId);
            if (userId) {
              try {
                await clearAuraConversationOnServer();
              } catch {
                // Offline — local clear still applies.
              }
            }
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <Pressable
        onLongPress={() => deleteMessage(item.id)}
        delayLongPress={400}
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}
      >
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>{item.content}</Text>
      </Pressable>
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
        {messages.length > 0 ? (
          <TextChip label="Clear" variant="muted" onPress={clearConversation} />
        ) : null}
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
              <View style={styles.typingBubble}>
                <TypingDots />
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
          <View style={styles.composerRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t("aura.placeholder")}
              placeholderTextColor={palette.textDim}
              style={styles.input}
              editable={!sending}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <GlowButton
              label={t("aura.send")}
              onPress={send}
              disabled={!canSend}
              loading={sending}
              size="compact"
              style={styles.sendBtn}
              fullWidth={false}
            />
          </View>
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
    backgroundColor: palette.surfaceHi,
    borderWidth: 1.5,
    borderColor: palette.borderGoldStrong,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glowGoldSoft,
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
    color: palette.gold,
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  headerText: { flex: 1 },
  title: { ...typography.title, fontSize: 20 },
  subtitle: { ...typography.bodyMuted, marginTop: 4, fontSize: 13 },
  chatCard: { flex: 1, padding: 14, minHeight: 280 },
  list: { gap: 10, paddingVertical: 4, paddingBottom: 8, flexGrow: 1 },
  welcomeBox: { gap: 8, paddingVertical: 8 },
  welcomeTitle: { color: palette.gold, fontSize: 16, fontWeight: "800" },
  emptyHint: { color: palette.text, fontSize: 15, lineHeight: 22 },
  retryBtn: { marginTop: 8, alignSelf: "flex-start" },
  typingBubble: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderGold,
    backgroundColor: palette.surfaceLo,
    marginTop: 4,
    ...shadow.glowGoldSoft,
  },
  typingText: { ...typography.caption, color: palette.textMuted },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: palette.gold,
    borderColor: palette.goldHigh,
    borderTopRightRadius: radius.xs,
    ...shadow.glowGoldSoft,
  },
  bubbleAi: {
    alignSelf: "flex-start",
    backgroundColor: palette.surface,
    borderColor: palette.borderGold,
    borderTopLeftRadius: radius.xs,
    ...shadow.soft,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  userText: { color: "#0a0a0a", fontWeight: "700" },
  aiText: { color: palette.text, fontWeight: "600" },
  composer: { marginTop: 10 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    backgroundColor: palette.surfaceLo,
    borderWidth: 1,
    borderColor: palette.borderGold,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 14,
    minHeight: 44,
  },
  sendBtn: { width: 108, alignSelf: "flex-end" },
});
