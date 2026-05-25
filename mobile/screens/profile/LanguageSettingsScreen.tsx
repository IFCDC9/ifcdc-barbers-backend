import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import { theme } from "../../constants/theme";
import {
  SUPPORTED_LANGUAGES,
  currentLanguage,
  detectDeviceLanguage,
  resetToDeviceLanguage,
  setLanguage,
  type SupportedLanguageCode,
} from "../../i18n";

function LanguageRow({
  code,
  nativeName,
  englishName,
  selected,
  onPress,
  busy,
}: {
  code: SupportedLanguageCode;
  nativeName: string;
  englishName: string;
  selected: boolean;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Set language to ${englishName}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && !selected && styles.rowPressed,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, selected && styles.rowTitleSelected]}>{nativeName}</Text>
        <Text style={styles.rowSub}>{englishName} · {code.toUpperCase()}</Text>
      </View>
      <View
        style={[
          styles.radioOuter,
          selected && { borderColor: theme.colors.gold, backgroundColor: "rgba(245,200,66,0.10)" },
        ]}
      >
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

export default function LanguageSettingsScreen() {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<SupportedLanguageCode>(currentLanguage());
  const [busy, setBusy] = useState(false);

  // Reflect external language changes (e.g. from another screen) immediately.
  React.useEffect(() => {
    const onChanged = (lng: string) => {
      const next = lng as SupportedLanguageCode;
      setActive(currentLanguage() === next ? next : currentLanguage());
    };
    i18n.on("languageChanged", onChanged);
    return () => {
      i18n.off("languageChanged", onChanged);
    };
  }, [i18n]);

  const deviceLang = useMemo(() => detectDeviceLanguage(), []);
  const deviceMeta = SUPPORTED_LANGUAGES.find((l) => l.code === deviceLang);
  const activeMeta = SUPPORTED_LANGUAGES.find((l) => l.code === active);

  const choose = async (code: SupportedLanguageCode) => {
    if (busy || code === active) return;
    setBusy(true);
    try {
      await setLanguage(code);
      setActive(code);
    } finally {
      setBusy(false);
    }
  };

  const useDevice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await resetToDeviceLanguage();
      setActive(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileScreenLayout
      title={t("language.title")}
      subtitle={t("language.subtitle")}
      headerTopPad={12}
    >
      <ProfileCard style={styles.summaryCard}>
        <Text style={styles.eyebrow}>{t("profile.menuLanguage")}</Text>
        <Text style={styles.summaryText}>
          {t("language.current", { name: activeMeta?.nativeName ?? active })}
        </Text>
        {deviceMeta ? (
          <Text style={styles.summaryHint}>
            {t("language.deviceDetected", { name: deviceMeta.nativeName })}
          </Text>
        ) : null}
      </ProfileCard>

      <ProfileCard style={styles.listCard}>
        {SUPPORTED_LANGUAGES.map((lang, idx) => (
          <View key={lang.code}>
            <LanguageRow
              code={lang.code}
              nativeName={lang.nativeName}
              englishName={lang.englishName}
              selected={active === lang.code}
              busy={busy}
              onPress={() => choose(lang.code)}
            />
            {idx < SUPPORTED_LANGUAGES.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </ProfileCard>

      <ProfileCard style={styles.deviceCard}>
        <GlowButton
          label={t("language.useDevice")}
          variant="outline"
          onPress={useDevice}
          disabled={busy}
        />
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryCard: { gap: 6, paddingVertical: 18 },
  eyebrow: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  summaryText: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  summaryHint: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4 },
  listCard: { paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowPressed: { backgroundColor: "rgba(245,200,66,0.06)" },
  rowSelected: {},
  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  rowTitleSelected: { color: theme.colors.gold },
  rowSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.08)" },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.gold,
  },
  deviceCard: { marginBottom: 24 },
});
