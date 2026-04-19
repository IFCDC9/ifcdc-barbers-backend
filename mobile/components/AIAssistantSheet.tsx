import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "../constants/theme";
import CardContainer from "./CardContainer";
import GlowButton from "./GlowButton";
import { apiFetch } from "../services/api";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AIAssistantSheet({ visible, onClose }: Props) {
  const [conversationId] = useState(() => `ai-${Date.now()}`);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Msg>>(null);

  const data = useMemo(() => messages, [messages]);

  React.useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    overlay.setValue(0);
    Animated.parallel([
      Animated.timing(overlay, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 1, speed: 22, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [visible, overlay, slide]);

  const close = () => {
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const canSend = text.trim().length > 0 && !sending;

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setText("");
    setSending(true);

    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ conversationId, message: trimmed }),
      });
      const json = (await res.json()) as { reply?: string };
      const reply = String(json?.reply || "Sorry — I couldn’t respond. Try again.");
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "AI is unavailable right now. Please try again." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>{item.content}</Text>
      </View>
    );
  };

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]}>
        <CardContainer glow style={styles.sheet}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>AURA Assistant</Text>
              <Text style={styles.subtitle}>Book appointments, get recommendations, and more.</Text>
            </View>
            <Pressable onPress={close} style={styles.closeBtn} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyHint}>
                Ask AURA to help you book, compare services, or answer shop questions. Messages stay in this session
                only.
              </Text>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ask the AI…"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              editable={!sending}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <View style={styles.actions}>
              <GlowButton
                label="🎙"
                onPress={() => {}}
                variant="outline"
                disabled
                style={{ width: 54 }}
                textStyle={{ fontSize: 16 }}
              />
              <GlowButton label="Send" onPress={send} disabled={!canSend} loading={sending} style={{ flex: 1 }} />
            </View>
          </View>
        </CardContainer>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
  },
  sheet: {
    padding: 16,
    maxHeight: "78%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: { color: theme.colors.text, fontWeight: "900", fontSize: 18, letterSpacing: 0.4 },
  subtitle: { color: theme.colors.textMuted, marginTop: 2, fontSize: 12 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  closeText: { color: theme.colors.textMuted, fontWeight: "800" },
  list: { gap: 10, paddingVertical: 8, paddingBottom: 12, flexGrow: 1 },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.gold,
    borderColor: "rgba(245,200,66,0.45)",
  },
  bubbleAi: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: "#111", fontWeight: "700" },
  aiText: { color: theme.colors.text, fontWeight: "600" },
  composer: { marginTop: 10 },
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
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
});

