/**
 * IFCDC Barbers — i18n entry point.
 *
 * Boot sequence:
 *   1. i18next is initialized **synchronously** at module load with English
 *      (and Spanish bundled in) so first render never sees missing keys.
 *   2. `bootstrapI18n()` is called once from `App.tsx` and asynchronously
 *      promotes the language to:
 *        a. The user's previously-saved choice (AsyncStorage `@ifcdc/lang`).
 *        b. The device locale, if it maps to a supported language.
 *        c. Otherwise stays on the synchronous English default.
 *   3. Subsequent calls to `setLanguage(code)` persist + activate.
 *
 * Usage:
 *   import { useTranslation } from "react-i18next";
 *   const { t } = useTranslation();
 *   t("common.save"); // "Save" / "Guardar"
 *
 * To add a new language: see ./languages.ts.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import en from "./locales/en.json";
import es from "./locales/es.json";
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  isSupportedLanguage,
  normalizeLocale,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from "./languages";

const STORAGE_KEY = "@ifcdc/lang";

const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;

/**
 * Synchronously initialize i18next with bundled resources. We do this at
 * module-load time so any component that reads `t(...)` during the very
 * first render receives English instead of a raw key string.
 *
 * Calling `init` multiple times is a no-op for i18next; the explicit guard
 * here keeps the intent obvious.
 */
let initialized = false;
function initSync() {
  if (initialized) return;
  initialized = true;
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: "v4",
    react: { useSuspense: false },
  });
}

initSync();

/**
 * Async bootstrap: promote the synchronously-defaulted English to the user's
 * stored choice or the device locale. Called once from `App.tsx`. Never
 * throws — failures fall back to whatever language is currently active.
 */
export async function bootstrapI18n(): Promise<SupportedLanguageCode> {
  let target: SupportedLanguageCode = DEFAULT_LANGUAGE;

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) {
      target = stored;
    } else {
      const device = detectDeviceLanguage();
      if (device !== DEFAULT_LANGUAGE) target = device;
    }
  } catch {
    /* ignore — keep English */
  }

  if (target !== currentLanguage()) {
    try {
      await i18n.changeLanguage(target);
    } catch {
      /* ignore */
    }
  }
  return target;
}

/** Currently active language code (synchronous). */
export function currentLanguage(): SupportedLanguageCode {
  const code = String(i18n.language || DEFAULT_LANGUAGE);
  return isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
}

/** Persist + activate a new language. Safe to await; never throws. */
export async function setLanguage(code: SupportedLanguageCode): Promise<void> {
  if (!isSupportedLanguage(code)) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore — non-fatal */
  }
  try {
    await i18n.changeLanguage(code);
  } catch {
    /* ignore */
  }
}

/** Clears the user's saved choice and reverts to device default. */
export async function resetToDeviceLanguage(): Promise<SupportedLanguageCode> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const deviceCode = detectDeviceLanguage();
  try {
    await i18n.changeLanguage(deviceCode);
  } catch {
    /* ignore */
  }
  return deviceCode;
}

/** Read the device's preferred language (without changing app state). */
export function detectDeviceLanguage(): SupportedLanguageCode {
  try {
    const deviceLocales = Localization.getLocales();
    const deviceTag =
      Array.isArray(deviceLocales) && deviceLocales.length > 0
        ? deviceLocales[0]?.languageTag
        : null;
    const deviceCode = normalizeLocale(deviceTag);
    if (deviceCode) return deviceCode;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

export { SUPPORTED_LANGUAGES, isSupportedLanguage, DEFAULT_LANGUAGE };
export type { SupportedLanguageCode };
export default i18n;
