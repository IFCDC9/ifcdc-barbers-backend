/**
 * IFCDC Barbers — theme facade (Phase 3).
 * Canonical tokens live in `src/theme/ifcdcTheme.ts`.
 * This module re-exports them for existing `constants/theme` imports.
 */

import { IFCDC_THEME } from "../src/theme/ifcdcTheme";

const c = IFCDC_THEME.colors;
const r = IFCDC_THEME.radius;
const s = IFCDC_THEME.shadow;

export const palette = {
  bg0: c.bg,
  bg1: c.bg1,
  bg2: c.surface2,
  card: c.surface,
  surface: c.surfaceGlass,
  surfaceHi: "rgba(26, 26, 26, 0.94)",
  surfaceLo: "rgba(8, 8, 8, 0.88)",
  surfaceLine: c.glass,
  hairline: c.hairline,
  border: c.hairline,
  borderGold: c.goldBorder,
  borderGoldStrong: c.goldBorderStrong,

  text: c.text,
  textMuted: c.muted,
  textDim: c.textDim,

  gold: c.gold,
  goldDeep: c.goldDeep,
  goldHigh: c.goldSoft,
  goldSoft: c.goldBorderStrong,
  goldHair: c.goldBorder,
  goldBg: c.goldBg,

  neon: c.success,
  danger: c.danger,
  dangerBg: c.dangerBg,
  warning: c.warning,
  success: c.success,
  onGold: c.onGold,
};

export const SPACE_UNIT = IFCDC_THEME.spacing.unit;
export function space(n: number): number {
  return Math.round(n * SPACE_UNIT);
}

export const radius = {
  xs: r.xs,
  sm: r.sm,
  md: r.md,
  lg: r.lg,
  xl: r.xl,
  pill: r.pill,
};

export const shadow = {
  soft: s.soft,
  deep: s.deep,
  glowGold: s.goldGlow,
  glowGoldStrong: s.goldGlow,
  glowGoldSoft: s.goldGlowSoft,
  glowDanger: s.dangerGlow,
};

export const typography = IFCDC_THEME.typography;

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
  glassCard: {
    ...IFCDC_THEME.glow.glassCard,
    ...shadow.soft,
  },
  glassHighlight: IFCDC_THEME.glow.glassHighlight,
};

export const tabBar = {
  ...IFCDC_THEME.tabBar,
  pillGlow: s.goldGlowSoft,
};

export const buttons = IFCDC_THEME.buttons;

export const switchColors = {
  trackOff: palette.bg2,
  trackOn: "rgba(212,175,55,0.45)",
  thumbOff: palette.textDim,
  thumbOn: palette.gold,
};

export const inputs = IFCDC_THEME.inputs;

export const ui = {
  sectionTitle: typography.eyebrow,
  screenTitle: typography.display,
  screenSubtitle: typography.bodyMuted,
  listGap: IFCDC_THEME.spacing.listGap,
  cardGap: IFCDC_THEME.spacing.cardGap,
  horizontalPad: IFCDC_THEME.spacing.horizontalPad,
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
  inputs,
  ui,
};

export { IFCDC_THEME } from "../src/theme/ifcdcTheme";
