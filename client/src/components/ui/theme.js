export const theme = {
  colors: {
    // New palette (black + gold)
    primary: "#0B0B0F",
    accent: "#D4AF37",
    secondary: "#1A1A22",
    text: "#FFFFFF",
    muted: "#A0A0A0",

    // Back-compat keys used by existing components/pages
    bg: "linear-gradient(180deg, #0B0B0F 0%, #07070B 100%)",
    border: "rgba(255,255,255,0.10)",
    card: "rgba(26,26,34,0.72)",
    subtle: "rgba(255,255,255,0.03)",
    muted2: "rgba(255,255,255,0.60)",
    indigoBorder: "rgba(212,175,55,0.40)",
    indigoBg: "rgba(212,175,55,0.14)",
    greenBorder: "rgba(212,175,55,0.30)",
    greenBg: "rgba(212,175,55,0.12)",
    danger: "rgba(248,113,113,0.95)",
  },
  radius: {
    // New radius API (string) + back-compat numeric keys
    base: "12px",
    lg: 18,
    md: 14,
    sm: 12,
    pill: 999,
  },
  layout: {
    maxWidth: 1040,
  },
};

