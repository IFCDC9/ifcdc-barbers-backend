import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../constants/theme";
import { shareNatively, type ShareResult } from "../utils/shareContent";

type Variant = "pill" | "block" | "icon";

export interface ShareButtonProps {
  /** Pre-formatted body of the share message. */
  message: string;
  /** Optional dialog title (Android share sheet header / iOS Mail subject). */
  title?: string;
  /** Optional Mail subject override (defaults to `title`). */
  subject?: string;
  /** Optional URL to attach (some share targets prefer a URL field). */
  url?: string;
  /** Visual style. Defaults to `pill`. */
  variant?: Variant;
  /** Override the visible label. Defaults to "Share". */
  label?: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Container override. */
  style?: StyleProp<ViewStyle>;
  /** Called after the share sheet closes (whether user shared or dismissed). */
  onShared?: (result: ShareResult) => void;
  /** Optional accessibility label (defaults to `Share via system share sheet`). */
  accessibilityLabel?: string;
}

/**
 * IFCDC ShareButton — opens the OS native share sheet for any installed app
 * (Facebook, Instagram, TikTok, X / Twitter, WhatsApp, Messages, Mail, …).
 *
 * Phase 1: text-only. No OAuth, no token storage, no direct API integration.
 */
export default function ShareButton({
  message,
  title,
  subject,
  url,
  variant = "pill",
  label = "Share",
  disabled,
  style,
  onShared,
  accessibilityLabel,
}: ShareButtonProps) {
  const [busy, setBusy] = useState(false);

  const onPress = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const result = await shareNatively({ message, title, subject, url });
      onShared?.(result);
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, message, title, subject, url, onShared]);

  const isIconOnly = variant === "icon";
  const isBlock = variant === "block";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `Share via system share sheet`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        isBlock && styles.block,
        isIconOnly && styles.icon,
        !isBlock && !isIconOnly && styles.pill,
        pressed && !disabled && !busy && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.gold} />
      ) : (
        <View style={styles.row}>
          <Ionicons
            name="share-social-outline"
            size={isBlock ? 18 : 16}
            color={palette.gold}
          />
          {!isIconOnly ? (
            <Text style={[styles.label, isBlock && styles.labelBlock]}>{label}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.goldBg,
    borderWidth: 1,
    borderColor: palette.goldHair,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  block: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  pressed: {
    backgroundColor: "rgba(245,200,66,0.18)",
    borderColor: palette.goldSoft,
  },
  disabled: {
    opacity: 0.5,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelBlock: {
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
