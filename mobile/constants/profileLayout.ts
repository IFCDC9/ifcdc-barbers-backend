import { theme } from "../constants/theme";

/** Bottom tab bar height (icons + labels). Keep in sync with app/_layout.tsx. */
export const PROFILE_TAB_BAR_HEIGHT = 60;

/** AURA floating orb diameter + halo clearance. */
export const PROFILE_AURA_ZONE = 88;

/** Right-side lane reserved so scroll content never sits under the AURA orb. */
export const PROFILE_AURA_LANE_WIDTH = 108;

/** Extra gap between last Profile content and the AURA orb. */
export const PROFILE_AURA_GAP = 40;

/** Compact footer row height (HomeTabs tab bar footer). */
export const IFCDC_FOOTER_HEIGHT = 26;

/** Extra scroll clearance so content clears the tab-bar footer strip. */
export const IFCDC_FOOTER_CLEARANCE = IFCDC_FOOTER_HEIGHT + 12;

/** Scroll padding for profile sub-screens (tab bar only — AURA is a tab). */
export function profileScrollBottomPad(safeAreaBottom: number): number {
  return profileTabScrollBottomPad(safeAreaBottom);
}

/** Scroll padding for tab-root screens (footer strip + tab bar + safe area). */
export function profileTabScrollBottomPad(safeAreaBottom: number): number {
  return safeAreaBottom + PROFILE_TAB_BAR_HEIGHT + IFCDC_FOOTER_HEIGHT + IFCDC_FOOTER_CLEARANCE + 8;
}

/** Profile home — tab bar only (AURA is a tab, not a floating orb). */
export function profileHomeBottomPad(safeAreaBottom: number): number {
  return profileTabScrollBottomPad(safeAreaBottom) + 16;
}

/** Shared profile card surface — dark glass, gold border, no inner circle overlays. */
export const profileCardStyle = {
  backgroundColor: "rgba(13, 13, 13, 0.92)",
  borderRadius: theme.radius.lg,
  borderWidth: 1,
  borderColor: theme.colors.borderGold,
  overflow: "hidden" as const,
  ...theme.shadow.soft,
};
