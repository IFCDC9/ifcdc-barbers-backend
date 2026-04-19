import Colors from "./Colors";

export const theme = {
  colors: {
    bg0: "#050505",
    bg1: "#0a0a0a",
    card: "#0d0d0d",
    border: "rgba(255,255,255,0.10)",
    borderGold: "rgba(245,200,66,0.30)",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.65)",
    gold: Colors.primary,
    neon: "#7CFF7A",
    danger: "#FF6B6B",
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
  },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 10,
    },
    glowGold: {
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 8,
    },
  },
};

