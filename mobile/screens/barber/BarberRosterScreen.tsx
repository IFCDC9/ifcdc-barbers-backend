import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { ScreenLoading, ScreenEmpty, ScreenError } from "../../components/LoadingState";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import BarberRosterCard from "../../components/BarberRosterCard";
import StaffRosterGuard from "../../components/StaffRosterGuard";
import { fetchBarberList, type BarberListRow } from "../../services/barberScheduleApi";
import { theme } from "../../constants/theme";

export type BarberRosterNavParams = {
  BarberDetail: { barberId: string; barberName: string };
};

function BarberRosterInner() {
  const navigation = useNavigation<StackNavigationProp<BarberRosterNavParams>>();
  const [rows, setRows] = useState<BarberListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchBarberList());
    } catch (e) {
      setError(userFacingApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProfileScreenLayout title="Barbers" subtitle="Tap a barber for details">
      {loading ? <ScreenLoading /> : null}
      {error ? <ScreenError message={error} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <ScreenEmpty message="No barbers in your roster." />
      ) : null}
      {rows.map((row) => {
        const id = String(row.id);
        const name = row.name || `Barber ${id}`;
        return (
          <BarberRosterCard
            key={id}
            barber={row}
            onPress={() => navigation.navigate("BarberDetail", { barberId: id, barberName: name })}
          />
        );
      })}
    </ProfileScreenLayout>
  );
}

export default function BarberRosterScreen() {
  return (
    <StaffRosterGuard>
      <BarberRosterInner />
    </StaffRosterGuard>
  );
}

const styles = StyleSheet.create({
  error: { color: "#f87171", marginTop: 16 },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
