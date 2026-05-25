import React, { useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { theme } from "../constants/theme";
import { formatAuditTimestamp, riskLabel, type AuditEventRow } from "../services/adminAuditApi";

type Props = {
  event: AuditEventRow;
};

function RiskBadge({ level }: { level: AuditEventRow["riskLevel"] }) {
  const tone =
    level === "critical" ? styles.riskCritical : level === "warning" ? styles.riskWarning : styles.riskNormal;
  const textTone =
    level === "critical"
      ? styles.riskTextCritical
      : level === "warning"
        ? styles.riskTextWarning
        : styles.riskTextNormal;
  return (
    <View style={[styles.riskPill, tone]}>
      <Text style={[styles.riskText, textTone]}>{riskLabel(level)}</Text>
    </View>
  );
}

export default function AuditEventCard({ event }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <ProfileCard style={[styles.card, styles.glass]}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <Text style={styles.action}>{event.action}</Text>
            <Text style={styles.user} numberOfLines={1}>
              {event.user}
            </Text>
            <Text style={styles.meta}>
              {event.role} · {formatAuditTimestamp(event.timestamp)}
            </Text>
          </View>
          <RiskBadge level={event.riskLevel} />
        </View>
        <View style={styles.grid}>
          <Meta label="IP" value={event.ip} />
          <Meta label="Device" value={event.device} />
        </View>
        {event.detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {event.detail}
          </Text>
        ) : null}
        <Text style={styles.categoryTag}>{event.category.toUpperCase()}</Text>
      </ProfileCard>
    </Animated.View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  glass: { borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1, gap: 3 },
  action: { color: theme.colors.gold, fontSize: 15, fontWeight: "800" },
  user: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  meta: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "500" },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  riskNormal: { borderColor: "rgba(124,255,122,0.35)", backgroundColor: "rgba(124,255,122,0.1)" },
  riskWarning: { borderColor: "rgba(245,200,66,0.45)", backgroundColor: "rgba(245,200,66,0.12)" },
  riskCritical: { borderColor: "rgba(255,107,107,0.45)", backgroundColor: "rgba(255,107,107,0.12)" },
  riskText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  riskTextNormal: { color: theme.colors.neon },
  riskTextWarning: { color: theme.colors.gold },
  riskTextCritical: { color: theme.colors.danger },
  grid: { flexDirection: "row", gap: 12, marginTop: 10 },
  metaCell: { flex: 1, gap: 2 },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metaValue: { color: theme.colors.text, fontSize: 12, fontWeight: "500" },
  detail: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
    fontStyle: "italic",
  },
  categoryTag: {
    color: "rgba(245,200,66,0.55)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 8,
  },
});
