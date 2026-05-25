import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  name: string;
  email: string;
  uri?: string | null;
  size?: number;
};

function initialsFrom(name: string, email: string): string {
  const n = name.trim();
  if (n && n !== "—") {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  return e.length >= 2 ? e.slice(0, 2).toUpperCase() : "IF";
}

export default function UserAvatar({ name, email, uri, size = 88 }: Props) {
  const radius = size / 2;
  const letters = initialsFrom(name, email);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.letters, { fontSize: size * 0.34 }]}>{letters}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  placeholder: {
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    backgroundColor: theme.colors.bg1,
    alignItems: "center",
    justifyContent: "center",
  },
  letters: {
    color: theme.colors.gold,
    fontWeight: "800",
  },
});
