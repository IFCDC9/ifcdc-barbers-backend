import React, { useCallback, useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { ScreenLoading } from "../../components/LoadingState";
import {
  NavigationProp,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import {
  fetchBookingById,
  type BookingDetail,
} from "../../services/bookingDetailApi";
import {
  patchAdminBookingAction,
  resendBookingConfirmation,
} from "../../services/adminBookingApi";
import {
  BOOKING_STATUSES,
  canRoleTransition,
  fetchStatusHistory,
  isFinalStatus,
  setBookingStatus,
  type BookingStatus,
  type BookingStatusHistoryRow,
} from "../../services/bookingStatusApi";
import {
  bookingStatusTone,
  displayCustomerEmail,
  displayCustomerName,
  formatBookingDateTime,
  formatCreatedAt,
  formatMoney,
  rawBookingStatusLabel,
} from "../../utils/bookingDisplay";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { useAuth } from "../../services/authContext";
import { theme } from "../../constants/theme";
import ShareButton from "../../components/ShareButton";
import {
  APP_BRAND_NAME,
  buildBookingShareMessage,
  buildReceiptShareMessage,
} from "../../utils/shareContent";

export type BookingDetailParams = { bookingId: string };

type Route = RouteProp<{ BookingDetail: BookingDetailParams }, "BookingDetail">;

type ActorRole = "super_admin" | "admin" | "shop_owner" | "barber" | "customer";

const DESTRUCTIVE_TARGETS: ReadonlyArray<BookingStatus> = [
  "cancelled",
  "no_show",
  "rescheduled",
];

function resolveActorRole(role?: string): ActorRole {
  const r = String(role || "").toLowerCase();
  if (r === "super_admin" || r === "admin" || r === "shop_owner" || r === "barber") return r;
  return "customer";
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function paymentMethodLabel(b: BookingDetail): string {
  const provider = String(b.payment_provider || "").trim().toLowerCase();
  const type = String(b.payment_type || "").trim().toLowerCase();
  if (provider === "paypal") return type === "deposit" ? "PayPal · Deposit" : "PayPal";
  if (type === "pay_in_person" || type === "in_person") return "Pay in person";
  if (type) return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (provider) return provider.replace(/\b\w/g, (c) => c.toUpperCase());
  return "—";
}

function paymentBreakdown(b: BookingDetail): string {
  const type = String(b.payment_type || "full").replace(/_/g, " ");
  const deposit = Number(b.deposit_amount);
  const paid = Number(b.amount_paid ?? b.total_paid);
  const remaining = Number(b.remaining_balance);
  if (type.includes("deposit") && Number.isFinite(deposit) && deposit > 0) {
    const rem = Number.isFinite(remaining) ? ` · Balance ${formatMoney(remaining)}` : "";
    return `Deposit ${formatMoney(deposit)} · Paid ${formatMoney(paid)}${rem}`;
  }
  return `Full payment · ${formatMoney(paid || b.total_amount || b.total_price)}`;
}

function servicePriceFor(b: BookingDetail): string {
  return formatMoney(b.total_price ?? b.amount);
}

function formatTimelineDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeActor(row: BookingStatusHistoryRow): string {
  const role = String(row.changed_by_role || "").trim();
  const email = String(row.changed_by_email || "").trim();
  if (row.synthetic) return "system";
  if (email && role) return `${role.replace(/_/g, " ")} · ${email}`;
  if (email) return email;
  if (role) return role.replace(/_/g, " ");
  return "—";
}

function StatusTimeline({
  history,
  bookingCreatedAt,
  currentStatus,
}: {
  history: BookingStatusHistoryRow[];
  bookingCreatedAt?: string;
  currentStatus?: string;
}) {
  const rows: BookingStatusHistoryRow[] = useMemo(() => {
    if (history.length === 0 && bookingCreatedAt && currentStatus) {
      return [
        {
          id: null,
          previous_status: null,
          new_status: currentStatus,
          changed_by_role: "system",
          changed_at: bookingCreatedAt,
          note: "Initial booking",
          synthetic: true,
        },
      ];
    }
    return history;
  }, [history, bookingCreatedAt, currentStatus]);

  if (rows.length === 0) {
    return <Text style={styles.muted}>Timeline will appear once the booking is updated.</Text>;
  }

  return (
    <View style={timelineStyles.column}>
      {rows.map((row, idx) => {
        const tone = bookingStatusTone(undefined, row.new_status);
        return (
          <View key={String(row.id ?? `s-${idx}`)} style={timelineStyles.row}>
            <View style={timelineStyles.dotCol}>
              <View
                style={[
                  timelineStyles.dot,
                  tone === "paid" && timelineStyles.dotPaid,
                  tone === "active" && timelineStyles.dotActive,
                  tone === "pending" && timelineStyles.dotPending,
                  tone === "cancelled" && timelineStyles.dotCancelled,
                  tone === "noshow" && timelineStyles.dotNoshow,
                  tone === "rescheduled" && timelineStyles.dotResched,
                ]}
              />
              {idx < rows.length - 1 ? <View style={timelineStyles.line} /> : null}
            </View>
            <View style={timelineStyles.copyCol}>
              <Text style={timelineStyles.statusLine}>
                {rawBookingStatusLabel(row.new_status)}
              </Text>
              <Text style={timelineStyles.metaLine}>{formatTimelineDate(row.changed_at)}</Text>
              <Text style={timelineStyles.metaLine}>by {describeActor(row)}</Text>
              {row.note ? <Text style={timelineStyles.note}>{row.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

type NavParams = {
  CancelBooking: { bookingId: string };
  RescheduleBooking: { bookingId: string };
};

export default function BookingDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<NavigationProp<NavParams>>();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const role = resolveActorRole(user?.role);
  const subtitle =
    role === "customer"
      ? "Your appointment"
      : role === "barber"
        ? "Barber console"
        : role === "shop_owner"
          ? "Shop console"
          : "Admin console";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [history, setHistory] = useState<BookingStatusHistoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, timeline] = await Promise.all([
        fetchBookingById(bookingId),
        fetchStatusHistory(bookingId).catch(() => []),
      ]);
      setBooking(detail);
      setHistory(timeline);
    } catch (e) {
      Alert.alert("Booking", userFacingApiError(e, "Booking could not be loaded."));
      setBooking(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const currentStatus = useMemo(
    () => String(booking?.booking_status || "").toLowerCase(),
    [booking?.booking_status],
  );

  const isOverride = role === "super_admin" || role === "admin";
  const inFinalState = isFinalStatus(currentStatus);

  // The dedicated Reschedule + Cancel buttons handle these — exclude them from
  // the inline status grid so the same action isn't shown twice.
  const HANDLED_BY_DEDICATED_BUTTONS: ReadonlyArray<BookingStatus> = useMemo(
    () => ["cancelled", "rescheduled"],
    [],
  );

  const canCancelHere = useMemo(() => {
    if (!booking || inFinalState) return false;
    return canRoleTransition(role, currentStatus, "cancelled");
  }, [booking, inFinalState, role, currentStatus]);

  const canRescheduleHere = useMemo(() => {
    if (!booking || inFinalState) return false;
    if (isOverride) return true;
    return (
      canRoleTransition(role, currentStatus, "rescheduled") ||
      canRoleTransition(role, currentStatus, "confirmed")
    );
  }, [booking, inFinalState, isOverride, role, currentStatus]);

  /** Buttons surfaced for the current state, in the order we want them shown. */
  const statusActions = useMemo<
    Array<{ status: BookingStatus; label: string; destructive?: boolean }>
  >(() => {
    if (!booking) return [];
    const candidates: Array<{ status: BookingStatus; label: string; destructive?: boolean }> = [];

    const add = (status: BookingStatus, label: string, destructive?: boolean) => {
      if (HANDLED_BY_DEDICATED_BUTTONS.includes(status)) return;
      if (canRoleTransition(role, currentStatus, status)) {
        candidates.push({ status, label, destructive });
      }
    };

    if (role === "customer") {
      // Customers' cancel/reschedule are handled by the primary buttons below.
    } else if (role === "barber") {
      add("checked_in", "Mark checked in");
      add("in_progress", "Start service");
      add("completed", "Mark completed");
      add("no_show", "Mark no-show", true);
    } else if (role === "shop_owner") {
      add("confirmed", "Confirm");
      add("checked_in", "Mark checked in");
      add("in_progress", "Start service");
      add("completed", "Mark completed");
      add("no_show", "Mark no-show", true);
    } else {
      // super_admin / admin → render every transition that isn't a no-op or
      // already represented by a dedicated button.
      for (const status of BOOKING_STATUSES) {
        if (status === currentStatus) continue;
        if (HANDLED_BY_DEDICATED_BUTTONS.includes(status)) continue;
        const destructive = DESTRUCTIVE_TARGETS.includes(status);
        candidates.push({
          status,
          label: `Override · ${rawBookingStatusLabel(status)}`,
          destructive,
        });
      }
    }

    return candidates;
  }, [booking, currentStatus, role, HANDLED_BY_DEDICATED_BUTTONS]);

  const canResend = role !== "customer";
  const canRefund = role === "super_admin" || role === "admin" || role === "shop_owner";
  const canViewReceipt = true;

  const updateStatus = useCallback(
    async (target: BookingStatus, label: string, destructive: boolean) => {
      if (!booking) return;
      const proceed = async () => {
        setBusy(true);
        try {
          const result = await setBookingStatus(bookingId, target);
          if (result.booking) {
            setBooking((prev) =>
              prev ? { ...prev, ...(result.booking as Partial<BookingDetail>) } : prev,
            );
          }
          Alert.alert("Updated", result.message);
          void load();
        } catch (e) {
          Alert.alert("Update failed", userFacingApiError(e, "Status could not be updated."));
        } finally {
          setBusy(false);
        }
      };

      if (destructive) {
        const messageMap: Record<string, string> = {
          cancelled:
            role === "customer"
              ? "Cancel this appointment? If you paid online, refunds are reviewed by the shop and aren't automatic."
              : "Cancel this booking? The customer keeps any prior PayPal capture until a refund is issued in the provider console.",
          no_show:
            "Mark this customer as a no-show? This is recorded in the booking history and can affect their account.",
          rescheduled:
            role === "customer"
              ? "Request to reschedule this appointment? The shop will follow up with a new slot."
              : "Mark this booking as needing a reschedule? You'll need to confirm a new time afterward.",
        };
        Alert.alert(label, messageMap[target] || "This action will change the booking record.", [
          { text: "Keep as is", style: "cancel" },
          { text: label, style: "destructive", onPress: () => void proceed() },
        ]);
      } else {
        Alert.alert(label, `${label}?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: () => void proceed() },
        ]);
      }
    },
    [booking, bookingId, load, role],
  );

  const onOpenCancel = useCallback(() => {
    navigation.navigate("CancelBooking", { bookingId });
  }, [navigation, bookingId]);

  const onOpenReschedule = useCallback(() => {
    navigation.navigate("RescheduleBooking", { bookingId });
  }, [navigation, bookingId]);

  const onResend = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      const message = await resendBookingConfirmation(bookingId);
      Alert.alert("Confirmation", message);
    } catch (e) {
      Alert.alert("Confirmation", userFacingApiError(e, "Confirmation could not be sent."));
    } finally {
      setBusy(false);
    }
  };

  const onContact = () => {
    if (!booking) return;
    if (role === "customer") {
      const shop = String(booking.shop_name || "the shop").trim();
      Alert.alert(
        "Contact shop",
        `For questions about this appointment, please reach out to ${shop} directly.`,
      );
      return;
    }
    const phone = String(booking.phone || "").trim();
    const email = String(booking.customer_email || "").trim();
    const cleanEmail = displayCustomerEmail(email);
    const usableEmail =
      cleanEmail !== "Guest customer" && cleanEmail !== "No email on file" ? cleanEmail : "";

    if (!phone && !usableEmail) {
      Alert.alert("Contact customer", "No customer contact info is on file for this booking.");
      return;
    }

    const choices: { text: string; onPress?: () => void; style?: "cancel" | "default" }[] = [];
    if (phone) {
      choices.push({
        text: `Call ${phone}`,
        onPress: () => {
          Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`).catch(() =>
            Alert.alert("Contact customer", phone),
          );
        },
      });
    }
    if (usableEmail) {
      choices.push({
        text: `Email ${usableEmail}`,
        onPress: () => {
          const subject = encodeURIComponent(
            `IFCDC Barbers — appointment ${String(bookingId).slice(0, 8)}`,
          );
          Linking.openURL(`mailto:${usableEmail}?subject=${subject}`).catch(() =>
            Alert.alert("Contact customer", usableEmail),
          );
        },
      });
    }
    choices.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Contact customer", "How would you like to reach them?", choices);
  };

  const onRefund = () => {
    Alert.alert(
      "Refund booking",
      "Record a refund and cancel this booking? PayPal settlement may require provider review.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm refund",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await patchAdminBookingAction(bookingId, "refund");
              if (result.booking) {
                setBooking((prev) =>
                  prev ? { ...prev, ...(result.booking as Partial<BookingDetail>) } : prev,
                );
              }
              Alert.alert("Refund recorded", result.message);
              void load();
            } catch (e) {
              Alert.alert(
                "Refund failed",
                userFacingApiError(e, "Refund could not be recorded right now."),
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onViewReceipt = () => {
    if (!booking) return;
    const lines: string[] = [];
    lines.push(`Booking #${String(booking.id).slice(0, 8)}`);
    lines.push(`Service: ${booking.service || booking.style_title || "—"}`);
    lines.push(`Service price: ${servicePriceFor(booking)}`);
    lines.push(`Platform fee: ${formatMoney(booking.platform_fee)}`);
    lines.push(`Total paid: ${formatMoney(booking.total_paid ?? booking.total_amount)}`);
    lines.push(`Method: ${paymentMethodLabel(booking)}`);
    if (booking.paypal_order_id) lines.push(`PayPal order: ${booking.paypal_order_id}`);
    if (booking.paypal_capture_id) lines.push(`PayPal capture: ${booking.paypal_capture_id}`);
    Alert.alert("Receipt", lines.join("\n"));
  };

  if (loading) {
    return (
      <ProfileScreenLayout title="Booking detail" subtitle={subtitle}>
        <ScreenLoading />
      </ProfileScreenLayout>
    );
  }

  if (!booking) {
    return (
      <ProfileScreenLayout title="Booking detail" subtitle={subtitle}>
        <Text style={styles.muted}>This appointment isn't available.</Text>
        <View style={{ height: 12 }} />
        <GlowButton label="Go back" variant="outline" onPress={() => navigation.goBack()} />
      </ProfileScreenLayout>
    );
  }

  const customerEmail = displayCustomerEmail(booking.customer_email);
  const customerName = displayCustomerName(booking.customer_name, booking.customer_email);
  const appointmentWhen = formatBookingDateTime(booking.date, booking.time, booking.created_at);
  const notesValue =
    String(booking.notes || "").trim() ||
    (booking.style_title && booking.style_title !== booking.service
      ? `Style: ${booking.style_title}`
      : "—");
  const durationLabel =
    booking.service_duration_minutes != null && Number(booking.service_duration_minutes) > 0
      ? `${Number(booking.service_duration_minutes)} min`
      : "—";

  return (
    <ProfileScreenLayout title="Booking detail" subtitle={subtitle} headerTopPad={12}>
      <ProfileCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.service}>
              {booking.service || booking.style_title || "Appointment"}
            </Text>
            <Text style={styles.when}>{appointmentWhen}</Text>
          </View>
          <BookingStatusBadge
            paymentStatus={booking.payment_status}
            bookingStatus={booking.booking_status}
          />
        </View>
        <Text style={styles.total}>
          {formatMoney(booking.total_amount ?? booking.total_price)}
        </Text>
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Status timeline</Text>
        <StatusTimeline
          history={history}
          bookingCreatedAt={booking.created_at}
          currentStatus={booking.booking_status || undefined}
        />
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <MetaRow label="Name" value={customerName} />
        <MetaRow label="Email" value={customerEmail} />
        {role !== "customer" ? (
          <MetaRow label="Phone" value={booking.phone ? String(booking.phone) : "—"} />
        ) : null}
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Appointment</Text>
        <MetaRow label="Booking ID" value={String(booking.id)} />
        <MetaRow label="Barber" value={booking.barber_name || "—"} />
        <MetaRow label="Shop" value={booking.shop_name || "—"} />
        <MetaRow label="Service" value={booking.service || booking.style_title || "—"} />
        <MetaRow label="Duration" value={durationLabel} />
        <MetaRow label="Scheduled" value={appointmentWhen} />
        <MetaRow
          label="Booking status"
          value={rawBookingStatusLabel(booking.booking_status || "confirmed")}
        />
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <MetaRow
          label="Payment status"
          value={String(booking.payment_status || "pending").replace(/_/g, " ")}
        />
        <MetaRow label="Service price" value={servicePriceFor(booking)} />
        <MetaRow label="Platform fee" value={formatMoney(booking.platform_fee)} />
        <MetaRow
          label="Total paid"
          value={formatMoney(booking.total_paid ?? booking.total_amount)}
        />
        <MetaRow label="Method" value={paymentMethodLabel(booking)} />
        <MetaRow label="Summary" value={paymentBreakdown(booking)} />
        {role !== "customer" ? (
          <>
            <MetaRow label="PayPal order" value={booking.paypal_order_id || "—"} />
            <MetaRow label="PayPal capture" value={booking.paypal_capture_id || "—"} />
          </>
        ) : null}
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <MetaRow label="Details" value={notesValue} />
        <MetaRow label="Created" value={formatCreatedAt(booking.created_at)} />
        {booking.cancelled_at ? (
          <MetaRow
            label="Cancelled"
            value={`${formatCreatedAt(booking.cancelled_at)}${
              booking.cancelled_by ? ` · ${String(booking.cancelled_by).replace(/_/g, " ")}` : ""
            }`}
          />
        ) : null}
        {booking.cancellation_reason ? (
          <MetaRow label="Cancel reason" value={String(booking.cancellation_reason)} />
        ) : null}
        {booking.rescheduled_at ? (
          <MetaRow
            label="Last rescheduled"
            value={`${formatCreatedAt(booking.rescheduled_at)}${
              booking.rescheduled_by ? ` · ${String(booking.rescheduled_by).replace(/_/g, " ")}` : ""
            }`}
          />
        ) : null}
        {booking.rescheduled_from_date ? (
          <MetaRow
            label="Moved from"
            value={`${String(booking.rescheduled_from_date).slice(0, 10)}${
              booking.rescheduled_from_time
                ? ` at ${String(booking.rescheduled_from_time).slice(0, 5)}`
                : ""
            }`}
          />
        ) : null}
      </ProfileCard>

      <View style={styles.actions}>
        {canViewReceipt ? (
          <GlowButton label="View receipt" variant="outline" onPress={onViewReceipt} disabled={busy} />
        ) : null}
        {canResend ? (
          <GlowButton
            label="Resend confirmation"
            variant="outline"
            onPress={() => void onResend()}
            disabled={busy}
            loading={busy}
          />
        ) : null}
        <GlowButton
          label={role === "customer" ? "Contact shop" : "Contact customer"}
          variant="outline"
          onPress={onContact}
          disabled={busy}
        />

        <ShareButton
          variant="block"
          label={
            String(booking.booking_status || "").toLowerCase() === "completed"
              ? "Share receipt"
              : "Share booking"
          }
          title={`${booking.service || "Appointment"} · ${APP_BRAND_NAME}`}
          message={
            String(booking.booking_status || "").toLowerCase() === "completed"
              ? buildReceiptShareMessage({
                  serviceName: booking.service || booking.style_title || null,
                  barberName: booking.barber_name || null,
                  shopName: booking.shop_name || null,
                  whenLabel: appointmentWhen,
                })
              : buildBookingShareMessage({
                  serviceName: booking.service || booking.style_title || null,
                  barberName: booking.barber_name || null,
                  shopName: booking.shop_name || null,
                  whenLabel: appointmentWhen,
                })
          }
        />

        {canRescheduleHere ? (
          <GlowButton label="Reschedule" onPress={onOpenReschedule} disabled={busy} />
        ) : null}
        {canCancelHere ? (
          <GlowButton
            label="Cancel appointment"
            variant="outline"
            onPress={onOpenCancel}
            disabled={busy}
          />
        ) : null}

        {statusActions.length > 0 ? (
          <View style={styles.statusGroup}>
            <Text style={styles.statusGroupHeader}>
              {isOverride ? "Override status" : "Status actions"}
            </Text>
            {statusActions.map((item) => (
              <GlowButton
                key={item.status}
                label={item.label}
                variant={item.destructive ? "outline" : "primary"}
                onPress={() => void updateStatus(item.status, item.label, !!item.destructive)}
                disabled={busy}
              />
            ))}
          </View>
        ) : !canRescheduleHere && !canCancelHere ? (
          <Text style={styles.terminalHint}>
            {isFinalStatus(booking.booking_status)
              ? "This appointment has reached a final state."
              : "No status changes are available from your role right now."}
          </Text>
        ) : null}

        {canRefund ? (
          <GlowButton
            label="Refund booking"
            variant="outline"
            onPress={onRefund}
            disabled={busy}
          />
        ) : null}
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.colors.textMuted, textAlign: "center", marginTop: 24, fontSize: 15 },
  hero: { gap: 10, paddingVertical: 16 },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: { flex: 1, gap: 4 },
  service: { color: theme.colors.gold, fontSize: 20, fontWeight: "800" },
  when: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  total: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  section: { gap: 2 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  metaLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "58%",
    textAlign: "right",
  },
  actions: { gap: 10, marginTop: 4, marginBottom: 8 },
  statusGroup: { gap: 10, marginTop: 6 },
  statusGroupHeader: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  terminalHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 4,
  },
});

const timelineStyles = StyleSheet.create({
  column: { gap: 4, paddingTop: 4 },
  row: { flexDirection: "row", gap: 12 },
  dotCol: { width: 16, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 4,
  },
  dotPaid: { backgroundColor: "#34d399" },
  dotActive: { backgroundColor: "#60a5fa" },
  dotPending: { backgroundColor: theme.colors.gold },
  dotCancelled: { backgroundColor: "#f87171" },
  dotNoshow: { backgroundColor: "#fb923c" },
  dotResched: { backgroundColor: "#a78bfa" },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 4,
  },
  copyCol: { flex: 1, paddingBottom: 14 },
  statusLine: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  metaLine: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  note: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 17,
  },
});
