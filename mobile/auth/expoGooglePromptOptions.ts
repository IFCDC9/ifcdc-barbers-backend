/**
 * Expo Go requires the AuthSession proxy (`auth.expo.io/.../start`).
 * Using `useProxy: false` opens raw Google in Safari and breaks the return path → "Safari cannot open the page" / cancel.
 */
export const EXPO_GO_GOOGLE_PROMPT_OPTIONS = {
  useProxy: true,
  projectNameForProxy: "@ifcdc696/ifcdc-barbers-backend",
  preferEphemeralSession: true,
} as const;
