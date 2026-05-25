import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import AppointmentTimeDropdown from "../../components/AppointmentTimeDropdown";
import { fetchBookingById, type BookingDetail } from "../../services/bookingDetailApi";
import {
  buildRescheduleDateOptions,
  fetchRescheduleSlots,
  rescheduleBooking,
  type RescheduleSlot,
} from "../../services/bookingRescheduleApi";
import { formatBookingDateTime } from "../../utils/bookingDisplay";
import { theme } from "../../constants/theme";

export type RescheduleBookingParams = { bookingId: string };

type Route = RouteProp<{ RescheduleBooking: RescheduleBookingParams }, "RescheduleBooking">;

const dateOptions = buildRescheduleDateOptions(14);

function shortDateLabel(value: string): string {
  if (!value) return "";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (value === todayStr) return "Today";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function RescheduleBookingScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [date, setDate] = useState<string>(dateOptions[0]?.value || "");
  const [slots, setSlots] = useState<RescheduleSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [time, setTime] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchBookingById(bookingId);
        if (cancelled) return;
        setBooking(detail);
        if (detail?.date) {
          const ymd =
            typeof detail.date === "string"
              ? detail.date.slice(0, 10)
              : new Date(detail.date as unknown as string).toISOString().slice(0, 10);
          if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
            const inOptions = dateOptions.some((o) => o.value === ymd);
            if (inOptions) setDate(ymd);
          }
        }
      } catch {
        if (!cancelled) setBooking(null);
      } finally {
        if (!cancelled) setLoadingBooking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const loadSlotsForDate = useCallback(
    async (target: string) => {
      if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setSlots([]);
      try {
        const payload = await fetchRescheduleSlots(bookingId, target);
        if (dateRef.current !== target) return; // stale
        setSlots(payload.slots);
        setTime("");
      } catch (e) {
        if (dateRef.current !== target) return;
        const msg = e instanceof Error ? e.message : String(e);
        setSlotsError(msg);
      } finally {
        if (dateRef.current === target) setSlotsLoading(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    if (!loadingBooking) void loadSlotsForDate(date);
  }, [date, loadingBooking, loadSlotsForDate]);

  const availableTimes = useMemo(
    () => slots.filter((s) => s.available).map((s) => s.time),
    [slots],
  );
  const hasAvailability = availableTimes.length > 0;

  const onSubmit = useCallback(async () => {
    if (!date || !time) {
      Alert.alert("Pick a slot", "Choose a new date and time before continuing.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await rescheduleBooking(bookingId, {
        date,
        time,
        note: note.trim() || undefined,
      });
      Alert.alert("Appointment rescheduled", result.message, [
        {
          text: "OK",
          onPress: () => {
            if (navigation.canGoBack()) navigation.goBack();
          },
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Reschedule failed", msg);
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, date, time, note, navigation]);

  const currentLabel = booking
    ? formatBookingDateTime(booking.date, booking.time, booking.created_at)
    : "—";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        <ProfileScreenLayout
          title="Reschedule appointment"
          subtitle={booking?.barber_name ? `with ${booking.barber_name}` : undefined}
          headerTopPad={12}
        >
          <ProfileCard style={styles.section}>
            <Text style={styles.sectionTitle}>Current appointment</Text>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value} numberOfLines={2}>
              {booking?.service || booking?.style_title || "Appointment"}
            </Text>
            <View style={{ height: 8 }} />
            <Text style={styles.label}>Scheduled</Text>
            <Text style={styles.value}>{currentLabel}</Text>
            {booking?.barber_name ? (
              <>
                <View style={{ height: 8 }} />
                <Text style={styles.label}>Barber</Text>
                <Text style={styles.value}>{booking.barber_name}</Text>
              </>
            ) : null}
          </ProfileCard>

          <ProfileCard style={styles.section}>
            <Text style={styles.sectionTitle}>Pick a new date</Text>
            <View style={styles.dateRowWrap}>
              {dateOptions.map((option) => {
                const selected = option.value === date;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDate(option.value)}
                    style={({ pressed }) => [
                      styles.dateChip,
                      selected && styles.dateChipSelected,
                      pressed && !selected && styles.dateChipPressed,
                    ]}
                    disabled={submitting}
                  >
                    <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>
                      {option.label}
                    </Text>
                    <Text
                      style={[styles.dateChipSub, selected && styles.dateChipSubSelected]}
                      numberOfLines={1}
                    >
                      {shortDateLabel(option.value) === option.label ? "" : option.value.slice(5)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ProfileCard>

          <ProfileCard style={[styles.section, styles.timeCard]}>
            <Text style={styles.sectionTitle}>Pick a new time</Text>
            {slotsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.gold} />
                <Text style={styles.helperRow}>Loading available slots…</Text>
              </View>
            ) : slotsError ? (
              <Text style={styles.errorText}>{slotsError}</Text>
            ) : !hasAvailability ? (
              <Text style={styles.helperRow}>
                No times available on this day. Pick another date above.
              </Text>
            ) : (
              <AppointmentTimeDropdown
                value={time || null}
                options={availableTimes}
                onSelect={(t: string) => setTime(t)}
                disabled={submitting}
              />
            )}
          </ProfileCard>

          <ProfileCard style={styles.section}>
            <Text style={styles.sectionTitle}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Anything the shop should know about this change?"
              placeholderTextColor={theme.colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!submitting}
            />
            <Text style={styles.helper}>
              Saved to the booking history. The customer will receive an updated confirmation email
              if email is enabled.
            </Text>
          </ProfileCard>

          <View style={styles.actions}>
            <GlowButton
              label={submitting ? "Saving…" : "Save reschedule"}
              onPress={onSubmit}
              disabled={loadingBooking || submitting || !time}
              loading={submitting}
            />
            <GlowButton
              label="Keep current time"
              variant="outline"
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
              }}
              disabled={submitting}
            />
          </View>
        </ProfileScreenLayout>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: { gap: 4 },
  timeCard: { zIndex: 30 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  value: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  helper: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  helperRow: { color: theme.colors.textMuted, fontSize: 13 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  errorText: { color: "#ff8a80", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  dateRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateChip: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 92,
  },
  dateChipPressed: { backgroundColor: "rgba(245,200,66,0.08)" },
  dateChipSelected: {
    backgroundColor: "rgba(245,200,66,0.16)",
    borderColor: "rgba(245,200,66,0.6)",
  },
  dateChipText: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  dateChipTextSelected: { color: theme.colors.gold },
  dateChipSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  dateChipSubSelected: { color: theme.colors.gold },
  actions: { gap: 10, marginTop: 4, marginBottom: 24 },
});
