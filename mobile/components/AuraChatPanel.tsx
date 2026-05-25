import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../constants/theme";
import GlowButton from "./GlowButton";
import ProfileCard from "./ProfileCard";
import { sendAuraChatMessage, type AuraChatMessage } from "../services/auraChatApi";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** Embedded text-only AURA chat (no modal, no voice). */
export default function AuraChatPanel() {
  const insets = useSafeAreaInsets();
  const [conversationId] = useState(() => `ai-${Date.now()}`);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const data = useMemo(() => messages, [messages]);
  const canSend = text.trim().length > 0 && !sending;

  const scrollToLatest = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const nextThread: AuraChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setSending(true);
    scrollToLatest();

    const { reply } = await sendAuraChatMessage({
      message: trimmed,
      conversationId,
      messages: nextThread,
    });

    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    setSending(false);
    scrollToLatest();
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
          <View pointerEvents="none" style={styles.orbHalo} />
          <View style={styles.orb}>
            <View pointerEvents="none" style={styles.orbInnerRing} />
            <Text style={styles.orbLabel}>AURA</Text>
          </View>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>AURA</Text>
          <Text style={styles.subtitle}>Text-only assistant — bookings, services, and shop info</Text>
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
              <Text style={styles.welcomeTitle}>Ask AURA</Text>
              <Text style={styles.emptyHint}>
                AURA is here to help with bookings, services, and shop questions.
              </Text>
              <Text style={styles.welcomeFoot}>Type a message below — text chat only.</Text>
            </View>
          }
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={theme.colors.gold} />
                <Text style={styles.typingText}>AURA is composing a reply…</Text>
              </View>
            ) : null
          }
          onContentSizeChange={scrollToLatest}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 4) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask AURA…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <GlowButton label="Send" onPress={send} disabled={!canSend} loading={sending} />
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
