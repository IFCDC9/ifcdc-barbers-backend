# IFCDC Barbers — Localization (i18n)

This folder owns every user-facing string in the mobile app. The architecture
is built on `i18next` + `react-i18next` so it scales from the current Phase 1
languages (English + Spanish) to future ones (French, Portuguese, Arabic with
RTL, Haitian Creole, etc.) without rewrites.

## File layout

```
mobile/i18n/
├── index.ts            # i18n boot, persistence, language helpers
├── languages.ts        # Supported-language registry + locale normalization
├── locales/
│   ├── en.json         # English (source of truth — every key must exist here)
│   └── es.json         # Spanish (Phase 1)
└── README.md           # this file
```

## Using a string in a screen

```tsx
import { useTranslation } from "react-i18next";

export default function MyScreen() {
  const { t } = useTranslation();
  return <Text>{t("common.save")}</Text>;
}
```

For interpolation:

```tsx
t("services.fromPrice", { price: "$25" });   // "From $25"
t("services.minutes",  { minutes: 30 });      // "30 min"
```

For a string outside React (utility, service, error helper):

```ts
import i18n from "../i18n";
const msg = i18n.t("errors.generic");
```

## Adding a new key

1. Add the key in `locales/en.json` (English is the source of truth).
2. Add the matching key in `locales/es.json` and every other shipped locale.
3. Use `t("namespace.key")` in code.

If a key is missing from a locale, i18next falls back to English. Missing keys
are intentional fallbacks, not errors — but try to keep parity.

## Adding a new language

1. Add an entry in `mobile/i18n/languages.ts`:

   ```ts
   { code: "fr", nativeName: "Français", englishName: "French", rtl: false },
   ```

2. Drop a `mobile/i18n/locales/fr.json` file mirroring `en.json`.
3. Import + register it in `mobile/i18n/index.ts`:

   ```ts
   import fr from "./locales/fr.json";
   const resources = {
     en: { translation: en },
     es: { translation: es },
     fr: { translation: fr },
   } as const;
   ```

4. (For RTL) set `rtl: true` and follow the React Native RTL guide
   (`I18nManager.forceRTL(true)`) in `index.ts`'s `setLanguage`.

## Persistence

The user's chosen language is stored under `@ifcdc/lang` in AsyncStorage. On
boot, the order of resolution is:

1. Stored value in AsyncStorage.
2. Device language (via `expo-localization`) — only if it maps to a
   supported language; otherwise ignored.
3. English fallback.

Use `setLanguage(code)` from `mobile/i18n/index.ts` to change it; it persists
and re-renders subscribed components automatically.

## What is — and isn't — translated yet

Phase 1 ships translations for: common buttons, errors, auth/signup, tabs,
home headline, booking flow labels, services, payment status, profile menu,
language settings, AURA chrome, legal index, and share share-sheet copy.

Per-screen body copy that hasn't been migrated yet still renders in its
original English. Each migrated screen replaces inline strings with `t(...)`
calls — there is no automatic crawler, just the deliberate migration pattern.
This keeps the change surface small and the risk of regressing real flows
near zero.
