import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import { useAuth } from "../../services/authContext";
import { cancelBookingById, fetchBookingById, type BookingDetail } from "../../services/bookingDetailApi";
import { formatBookingDateTime } from "../../utils/bookingDisplay";
import { theme } from "../../constants/theme";

export type CancelBookingParams = { bookingId: string };

type Route = RouteProp<{ CancelBooking: CancelBookingParams }, "CancelBooking">;

export default function CancelBookingScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const canBlockSlot =
    role === "super_admin" || role === "admin" || role === "shop_owner";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [reason, setReason] = useState("");
  const [blockSlot, setBlockSlot] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchBookingById(bookingId);
        if (!cancelled) setBooking(detail);
      } catch {
        if (!cancelled) setBooking(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const onConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await cancelBookingById(bookingId, {
        reason: reason.trim() || undefined,
        blockSlot: canBlockSlot ? blockSlot : false,
      });
      Alert.alert(
        "Appointment cancelled",
        result.refundReviewRequired
          ? `${result.message}\n\nRefund review may be required depending on payment policy.`
          : result.message,
        [
          {
            text: "OK",
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
            },
          },
        ],
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Cancel failed", msg);
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, reason, blockSlot, canBlockSlot, navigation]);

  const onConfirmTap = () => {
    Alert.alert(
      "Cancel appointment?",
      "Are you sure you want to cancel this appointment? Refund review may be required depending on payment policy.",
      [
        { text: "Keep appointment", style: "cancel" },
        {
          text: "Cancel appointment",
          style: "destructive",
          onPress: () => void onConfirm(),
        },
      ],
    );
  };

  const subtitle =
    role === "customer"
      ? "Cancel your appointment"
      : role === "barber"
        ? "Cancel from barber console"
        : role === "shop_owner"
          ? "Cancel from shop console"
          : "Cancel from admin console";

  const apptWhen = booking
    ? formatBookingDateTime(booking.date, booking.time, booking.created_at)
    : "—";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        <ProfileScreenLayout title="Cancel appointment" subtitle={subtitle} headerTopPad={12}>
          <ProfileCard style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment</Text>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value} numberOfLines={2}>
              {booking?.service || booking?.style_title || "Appointment"}
            </Text>
            <View style={{ height: 8 }} />
            <Text style={styles.label}>Scheduled</Text>
            <Text style={styles.value}>{apptWhen}</Text>
            {booking?.barber_name ? (
              <>
                <View style={{ height: 8 }} />
                <Text style={styles.label}>Barber</Text>
                <Text style={styles.value}>{booking.barber_name}</Text>
              </>
            ) : null}
          </ProfileCard>

          <ProfileCard style={styles.section}>
            <Text style={styles.sectionTitle}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Add a short note (visible to staff)"
              placeholderTextColor={theme.colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!submitting && !loading}
            />
            <Text style={styles.helper}>
              The reason is recorded in the booking history and shared with the shop.
            </Text>
          </ProfileCard>

          {canBlockSlot ? (
            <ProfileCard style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Hold this slot</Text>
                  <Text style={styles.helper}>
                    Keep the time block reserved (e.g. for staff scheduling). Leave off to free up
                    the slot for new customers immediately.
                  </Text>
                </View>
                <Switch
                  value={blockSlot}
                  onValueChange={setBlockSlot}
                  disabled={submitting}
                  trackColor={{ true: theme.colors.gold, false: "rgba(255,255,255,0.18)" }}
                  thumbColor={blockSlot ? "#fff" : "#f4f4f5"}
                />
              </View>
            </ProfileCard>
          ) : null}

          <ProfileCard style={styles.section}>
            <Text style={styles.refundCopy}>
              Refund review may be required depending on payment policy. Your shop will follow up if
              applicable.
            </Text>
          </ProfileCard>

          <View style={styles.actions}>
            <GlowButton
              label={submitting ? "Cancelling…" : "Cancel appointment"}
              variant="outline"
              onPress={onConfirmTap}
              disabled={loading || submitting}
              loading={submitting}
            />
            <GlowButton
              label="Keep appointment"
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
  helper: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  refundCopy: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { gap: 10, marginTop: 4, marginBottom: 24 },
});
