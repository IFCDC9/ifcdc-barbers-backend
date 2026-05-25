import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export default function ScheduleTimeField({ label, value, onChange, placeholder = "09:00" }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.35)"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={5}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 4 },
  label: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  input: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
