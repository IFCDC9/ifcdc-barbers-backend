import Colors from "./Colors";

/**
 * IFCDC Barbers — futuristic black/gold design system.
 *
 * This module is the single source of truth for visual tokens (colors,
 * spacing, radius, shadow, typography, glow). All shared components consume
 * these tokens, so a change here propagates to the whole app.
 *
 * IMPORTANT: This is a UI-only system. Adding/changing tokens never affects
 * backend logic, payment flow, AURA backend, auth, or database schema.
 */

const GOLD = Colors.primary; // base brand gold "#f5c842"
const GOLD_DEEP = "#c89726"; // shadow / pressed gold
const GOLD_HIGH = "#fdd66a"; // bright top highlight
const GOLD_SOFT = "rgba(245,200,66,0.55)";
const GOLD_HAIR = "rgba(245,200,66,0.32)";
const GOLD_BG = "rgba(245,200,66,0.10)";

export const palette = {
  bg0: "#050505",
  bg1: "#0a0a0a",
  bg2: "#101010",
  /** Legacy solid card surface (used by some pre-glass components). */
  card: "#0d0d0d",
  surface: "rgba(13, 13, 13, 0.92)",
  surfaceHi: "rgba(20, 20, 20, 0.94)",
  surfaceLo: "rgba(8, 8, 8, 0.85)",
  surfaceLine: "rgba(255, 255, 255, 0.06)",
  hairline: "rgba(255, 255, 255, 0.08)",
  border: "rgba(255,255,255,0.10)",
  borderGold: GOLD_HAIR,
  borderGoldStrong: GOLD_SOFT,

  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.65)",
  textDim: "rgba(255,255,255,0.45)",

  gold: GOLD,
  goldDeep: GOLD_DEEP,
  goldHigh: GOLD_HIGH,
  goldSoft: GOLD_SOFT,
  goldHair: GOLD_HAIR,
  goldBg: GOLD_BG,

  neon: "#7CFF7A",
  danger: "#FF6B6B",
  dangerBg: "rgba(255, 107, 107, 0.12)",
  warning: "#FFB857",
  success: "#7CFF7A",
};

/**
 * 4-pt spacing grid. Use `space(n)` for any margin / padding.
 * 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 5 = 20px, 6 = 24px, 8 = 32px, …
 */
export const SPACE_UNIT = 4;
export function space(n: number): number {
  return Math.round(n * SPACE_UNIT);
}

export const radius = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

const shadowSoft = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 20,
  elevation: 10,
};

const shadowDeep = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.5,
  shadowRadius: 32,
  elevation: 16,
};

const glowGold = {
  shadowColor: GOLD,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.18,
  shadowRadius: 18,
  elevation: 8,
};

const glowGoldStrong = {
  shadowColor: GOLD,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.45,
  shadowRadius: 24,
  elevation: 14,
};

const glowGoldSoft = {
  shadowColor: GOLD,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 6,
};

const glowDanger = {
  shadowColor: "#FF6B6B",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.25,
  shadowRadius: 14,
  elevation: 6,
};

export const shadow = {
  soft: shadowSoft,
  deep: shadowDeep,
  glowGold,
  glowGoldStrong,
  glowGoldSoft,
  glowDanger,
};

export const typography = {
  brand: {
    fontSize: 18,
    fontWeight: "900" as const,
    letterSpacing: 1.6,
    color: GOLD,
  },
  display: {
    fontSize: 28,
    fontWeight: "900" as const,
    letterSpacing: 0.2,
    color: palette.text,
  },
  title: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: palette.text,
  },
  heading: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: palette.text,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    color: GOLD,
  },
  body: {
    fontSize: 14.5,
    fontWeight: "500" as const,
    color: palette.text,
    lineHeight: 22,
  },
  bodyMuted: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: palette.textMuted,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: palette.textMuted,
    letterSpacing: 0.4,
  },
  micro: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: palette.textMuted,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "900" as const,
    letterSpacing: 0.4,
  },
};

/**
 * Reusable visual recipes. Compose at the component layer instead of
 * re-deriving the same border/shadow combos in every StyleSheet.
 */
export const glow = {
  goldHairline: {
    borderWidth: 1,
    borderColor: palette.borderGold,
  },
  goldHairlineStrong: {
    borderWidth: 1.25,
    borderColor: palette.borderGoldStrong,
  },
  goldFill: {
    backgroundColor: palette.goldBg,
  },
  /** Glassmorphism card surface used by CardContainer / ProfileCard. */
  glassCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderGold,
    overflow: "hidden" as const,
    ...shadowSoft,
  },
  /** Subtle inner highlight to fake glass top edge — overlay on top of card. */
  glassHighlight: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
};

/**
 * Legacy export kept for compatibility with existing `theme.colors.*`,
 * `theme.radius.*`, and `theme.shadow.*` consumers across the app. New code
 * should import from `palette`, `radius`, `shadow`, `typography`, `glow`,
 * and `space()` directly for clarity.
 */
/** Bottom tab navigator tokens */
export const tabBar = {
  background: "rgba(6, 6, 6, 0.98)",
  borderTopColor: "rgba(245,200,66,0.22)",
  activeTint: GOLD,
  inactiveTint: "rgba(255,255,255,0.42)",
  labelSize: 10.5,
  iconActiveSize: 22,
  iconInactiveSize: 20,
  pillWidth: 40,
  pillHeight: 28,
  pillRadius: 14,
  pillBackground: "rgba(245,200,66,0.14)",
  pillBorder: GOLD_SOFT,
  pillGlow: glowGoldSoft,
};

/** Consistent button metrics */
export const buttons = {
  minHeight: 48,
  minHeightCompact: 40,
  paddingVertical: 14,
  paddingVerticalCompact: 10,
  paddingHorizontal: 16,
  gap: 10,
};

/** React Native Switch track/thumb defaults */
export const switchColors = {
  trackOff: palette.bg2,
  trackOn: "rgba(245,200,66,0.45)",
  thumbOff: palette.textDim,
  thumbOn: palette.gold,
};

/** Shared section / list row recipes */
export const ui = {
  sectionTitle: typography.eyebrow,
  screenTitle: typography.display,
  screenSubtitle: typography.bodyMuted,
  listGap: space(3),
  cardGap: space(3),
  horizontalPad: space(6),
};

export const theme = {
  colors: palette,
  radius,
  shadow,
  typography,
  glow,
  space,
  tabBar,
  buttons,
  ui,
};
