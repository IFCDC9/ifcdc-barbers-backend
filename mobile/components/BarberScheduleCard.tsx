import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import GlowButton from "./GlowButton";
import { theme } from "../constants/theme";
import type { BarberSchedule } from "../services/barberScheduleApi";
import { summarizeSchedule } from "../utils/scheduleModel";

type Props = {
  barberName: string;
  schedule: BarberSchedule | null;
  loading?: boolean;
  unavailable?: boolean;
  onEdit: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function BarberScheduleCard({
  barberName,
  schedule,
  loading,
  unavailable,
  onEdit,
}: Props) {
  const summary = schedule ? summarizeSchedule(schedule) : null;

  return (
    <ProfileCard style={styles.card}>
      <Text style={styles.name}>{barberName}</Text>
      {loading ? <ActivityIndicator color={theme.colors.gold} style={{ marginVertical: 12 }} /> : null}
      {unavailable && !loading ? (
        <Text style={styles.scheduleHint}>Schedule details are not available — tap Edit Schedule to add availability.</Text>
      ) : null}
      {summary ? (
        <View style={styles.details}>
          <Row label="Working days" value={summary.workingDays} />
          <Row label="Hours" value={summary.hours} />
          <Row label="Breaks" value={summary.breaks} />
          <Row label="Blocked dates" value={summary.blocked} />
          <Row label="Interval" value={summary.interval} />
          <Row label="Timezone" value={summary.timezone} />
        </View>
      ) : !loading && !unavailable ? (
        <Text style={styles.muted}>Tap Edit Schedule to view or create availability.</Text>
      ) : null}
      <View style={styles.btnWrap}>
        <GlowButton label="Edit Schedule" variant="outline" onPress={onEdit} />
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  name: { color: theme.colors.gold, fontSize: 18, fontWeight: "800" },
  details: { gap: 8, marginTop: 4 },
  row: { gap: 2 },
  rowLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  rowValue: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
  scheduleHint: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  btnWrap: { marginTop: 8 },
});
