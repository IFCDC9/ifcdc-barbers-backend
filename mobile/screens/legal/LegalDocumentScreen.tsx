import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import {
  LEGAL_DOCUMENTS,
  type LegalDocKey,
  type LegalDocument,
} from "../../constants/legalContent";
import { theme } from "../../constants/theme";

export type LegalDocumentScreenProps = {
  doc: LegalDocument;
};

function formatEffective(value: string): string {
  // value is YYYY-MM-DD; print "Effective May 25, 2026"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return `Effective ${value}`;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return `Effective ${value}`;
  return `Effective ${d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

function paragraphFromBody(body: string | string[]) {
  if (Array.isArray(body)) {
    return body.map((line, i) => (
      <View key={`b-${i}`} style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>{line}</Text>
      </View>
    ));
  }
  return <Text style={styles.paragraph}>{body}</Text>;
}

export default function LegalDocumentRenderer({ doc }: LegalDocumentScreenProps) {
  const effective = useMemo(() => formatEffective(doc.effective), [doc.effective]);
  return (
    <ProfileScreenLayout title={doc.title} subtitle={doc.summary} headerTopPad={12}>
      <ProfileCard style={styles.metaCard}>
        <Text style={styles.eyebrow}>Document</Text>
        <Text style={styles.metaTitle}>{doc.title}</Text>
        <Text style={styles.metaEffective}>{effective}</Text>
      </ProfileCard>

      {doc.sections.map((section, idx) => (
        <ProfileCard key={`${doc.key}-s-${idx}`} style={styles.sectionCard}>
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          {paragraphFromBody(section.body)}
        </ProfileCard>
      ))}

      <ProfileCard style={styles.contactCard}>
        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.paragraph}>
          Questions about this document?{" "}
          <Text
            style={styles.linkText}
            onPress={() =>
              Linking.openURL("mailto:support@ifcdcbarbersapp.com").catch(() => undefined)
            }
          >
            support@ifcdcbarbersapp.com
          </Text>
        </Text>
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

/**
 * Convenience wrapper to render a doc by key. The 8 thin screens use this so
 * they all share the same renderer.
 */
export function renderLegalDocByKey(key: LegalDocKey) {
  const doc = LEGAL_DOCUMENTS[key];
  return <LegalDocumentRenderer doc={doc} />;
}

const styles = StyleSheet.create({
  metaCard: { gap: 6, paddingVertical: 18 },
  eyebrow: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  metaTitle: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  metaEffective: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  sectionCard: { gap: 6 },
  heading: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  paragraph: {
    color: theme.colors.text,
    fontSize: 14.5,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  bulletDot: {
    color: theme.colors.gold,
    fontSize: 14,
    lineHeight: 22,
    width: 12,
  },
  bulletText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14.5,
    lineHeight: 22,
  },
  contactCard: { gap: 4, marginBottom: 24 },
  linkText: { color: theme.colors.gold, fontWeight: "700" },
});
