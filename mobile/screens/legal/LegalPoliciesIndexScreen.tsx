import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOC_ORDER,
  POLICY_VERSION,
  type LegalDocKey,
} from "../../constants/legalContent";
import { theme } from "../../constants/theme";

const ROUTE_BY_DOC: Record<LegalDocKey, string> = {
  privacy: "PrivacyPolicy",
  terms: "TermsConditions",
  cancellation: "CancellationPolicy",
  platformFee: "PlatformFeeDisclosure",
  aura: "AuraDisclosure",
  barberTerms: "BarberTerms",
  notifications: "NotificationConsent",
  security: "SecurityNotice",
};

function PolicyRow({
  title,
  summary,
  onPress,
}: {
  title: string;
  summary: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSummary} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function LegalPoliciesIndexScreen() {
  const navigation = useNavigation<any>();
  return (
    <ProfileScreenLayout
      title="Legal & Policies"
      subtitle="Everything that governs your account, bookings, and data"
      headerTopPad={12}
    >
      <ProfileCard style={styles.headerCard}>
        <Text style={styles.eyebrow}>Compliance</Text>
        <Text style={styles.headerTitle}>IFCDC Barbers policy library</Text>
        <Text style={styles.headerSub}>
          Read each document carefully. The effective date applies to every
          policy below.
        </Text>
        <View style={styles.versionPill}>
          <Text style={styles.versionPillText}>Effective {POLICY_VERSION}</Text>
        </View>
      </ProfileCard>

      <ProfileCard style={styles.listCard}>
        {LEGAL_DOC_ORDER.map((key, idx) => {
          const doc = LEGAL_DOCUMENTS[key];
          return (
            <View key={doc.key}>
              <PolicyRow
                title={doc.title}
                summary={doc.summary}
                onPress={() => navigation.navigate(ROUTE_BY_DOC[doc.key])}
              />
              {idx < LEGAL_DOC_ORDER.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          );
        })}
      </ProfileCard>

      <ProfileCard style={styles.contactCard}>
        <Text style={styles.contactTitle}>Need a copy on file?</Text>
        <Text style={styles.contactBody}>
          Email support@ifcdcbarbersapp.com from the address on your account and
          we'll send the latest versions of every policy as a single PDF.
        </Text>
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 6, paddingVertical: 18 },
  eyebrow: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  headerTitle: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  headerSub: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  versionPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,200,66,0.16)",
    borderColor: "rgba(245,200,66,0.6)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  versionPillText: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  listCard: { paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowPressed: { backgroundColor: "rgba(245,200,66,0.06)" },
  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  rowSummary: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  chevron: { color: theme.colors.gold, fontSize: 24, lineHeight: 24, fontWeight: "300" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.08)" },
  contactCard: { gap: 6, marginBottom: 24 },
  contactTitle: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  contactBody: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
});
