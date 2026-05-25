/**
 * IFCDC Barbers — supported languages registry.
 *
 * To add a new language:
 *   1. Add an entry below.
 *   2. Drop a `{code}.json` file into `mobile/i18n/locales/` mirroring `en.json`.
 *   3. Import it in `mobile/i18n/index.ts` and add to the `resources` map.
 *
 * Phase 1 ships with English + Spanish. Future-ready entries are listed but
 * commented out — uncomment after the matching JSON file is added so the
 * language picker doesn't show options that have no translations yet.
 */

export type SupportedLanguageCode =
  | "en"
  | "es"
  // | "fr"  // French — uncomment when locales/fr.json is added
  // | "pt"  // Portuguese — uncomment when locales/pt.json is added
  // | "ar"  // Arabic — uncomment when locales/ar.json is added (RTL)
  // | "ht"  // Haitian Creole — uncomment when locales/ht.json is added
  ;

export type LanguageMeta = {
  /** BCP-47-style code used internally and stored on device. */
  code: SupportedLanguageCode;
  /** Display name in the language itself ("Español", not "Spanish"). */
  nativeName: string;
  /** Display name in English (for UI labels in English mode). */
  englishName: string;
  /** Right-to-left script flag (used later for Arabic, Hebrew, etc.). */
  rtl: boolean;
};

export const SUPPORTED_LANGUAGES: readonly LanguageMeta[] = [
  { code: "en", nativeName: "English",  englishName: "English", rtl: false },
  { code: "es", nativeName: "Español",  englishName: "Spanish", rtl: false },
] as const;

export const DEFAULT_LANGUAGE: SupportedLanguageCode = "en";
export const FALLBACK_LANGUAGE: SupportedLanguageCode = "en";

export function isSupportedLanguage(code: string | null | undefined): code is SupportedLanguageCode {
  if (!code) return false;
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** Normalize a raw locale ("en-US", "es-419", "es_MX") to a supported code or null. */
export function normalizeLocale(raw: string | null | undefined): SupportedLanguageCode | null {
  if (!raw) return null;
  const lower = String(raw).toLowerCase().replace(/_/g, "-");
  // Try the full tag first (e.g. "en-US"), then the primary subtag ("en").
  if (isSupportedLanguage(lower)) return lower;
  const primary = lower.split("-")[0];
  if (isSupportedLanguage(primary)) return primary;
  return null;
}
