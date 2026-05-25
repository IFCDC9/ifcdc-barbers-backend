import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { ScreenLoading, ScreenEmpty, ScreenError } from "../../components/LoadingState";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import BarberScheduleCard from "../../components/BarberScheduleCard";
import ScheduleRouteGuard from "../../components/ScheduleRouteGuard";
import {
  fetchBarberList,
  fetchBarberSchedule,
  type BarberListRow,
  type BarberSchedule,
} from "../../services/barberScheduleApi";
import { subscribeScheduleUpdated } from "../../services/scheduleEvents";
import { theme } from "../../constants/theme";

type ScheduleNavParams = {
  EditBarberSchedule: { barberId: string; barberName: string };
};

function ScheduleControlsInner({ standalone = false }: { standalone?: boolean }) {
  const navigation = useNavigation<StackNavigationProp<ScheduleNavParams>>();
  const [barbers, setBarbers] = useState<BarberListRow[]>([]);
  const [schedules, setSchedules] = useState<Record<string, BarberSchedule>>({});
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadBarbers = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const rows = await fetchBarberList();
      setBarbers(rows);
    } catch (e) {
      setListError(userFacingApiError(e));
      setBarbers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAllSchedules = useCallback(async (rows: BarberListRow[]) => {
    setLoadingSchedules(true);
    const nextSchedules: Record<string, BarberSchedule> = {};
    const nextUnavailable: Record<string, boolean> = {};
    await Promise.all(
      rows.map(async (row) => {
        const id = String(row.id);
        try {
          nextSchedules[id] = await fetchBarberSchedule(id);
        } catch {
          nextUnavailable[id] = true;
        }
      }),
    );
    setSchedules(nextSchedules);
    setUnavailable(nextUnavailable);
    setLoadingSchedules(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBarbers();
    }, [loadBarbers]),
  );

  useFocusEffect(
    useCallback(() => {
      if (barbers.length) void loadAllSchedules(barbers);
    }, [barbers, loadAllSchedules]),
  );

  useEffect(() => {
    if (barbers.length) void loadAllSchedules(barbers);
    else {
      setSchedules({});
      setUnavailable({});
    }
  }, [barbers, loadAllSchedules]);

  useEffect(() => {
    return subscribeScheduleUpdated(() => {
      if (barbers.length) void loadAllSchedules(barbers);
    });
  }, [barbers, loadAllSchedules]);

  return (
    <ProfileScreenLayout
      title="Schedule controls"
      subtitle="Manage barber availability"
      standalone={standalone}
    >
      {loadingList ? <ScreenLoading /> : null}
      {listError ? <ScreenError message={listError} /> : null}
      {!loadingList && !listError && barbers.length === 0 ? (
        <ScreenEmpty message="No barbers available for your account." />
      ) : null}
      {barbers.map((row) => {
        const id = String(row.id);
        const name = row.name || `Barber ${id}`;
        return (
          <BarberScheduleCard
            key={id}
            barberName={name}
            schedule={schedules[id] ?? null}
            loading={loadingSchedules && !schedules[id] && !unavailable[id]}
            unavailable={unavailable[id] ?? false}
            onEdit={() => navigation.navigate("EditBarberSchedule", { barberId: id, barberName: name })}
          />
        );
      })}
    </ProfileScreenLayout>
  );
}

export default function ScheduleControlsScreen({ standalone = false }: { standalone?: boolean }) {
  return (
    <ScheduleRouteGuard>
      <ScheduleControlsInner standalone={standalone} />
    </ScheduleRouteGuard>
  );
}

const styles = StyleSheet.create({
  error: { color: "#f87171", marginTop: 16 },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
