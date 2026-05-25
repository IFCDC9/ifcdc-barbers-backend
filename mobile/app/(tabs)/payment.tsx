import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  ScrollView,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { BACKEND_URL, apiFullUrl } from '../../constants/config';
import { reportConnectionFailure, reportConnectionRecovered } from '../../services/connectionAlerts';
import CardContainer from '../../components/CardContainer';
import GlowButton from '../../components/GlowButton';
import { theme } from '../../constants/theme';

interface PaymentScreenProps {
  onSuccess?: (bookingId: string, orderId: string) => void;
  onCancel?: () => void;
}

interface BookingResponse {
  booking?: {
    id: number;
    service?: string;
    date?: string;
    time?: string;
  };
  error?: string;
}

const PaymentScreen = ({
  onSuccess,
  onCancel,
}: PaymentScreenProps) => {
  const webViewRef = useRef<WebView>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [barberName, setBarberName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);

  const checkoutUrl = useMemo(() => {
    if (!bookingId) {
      return "";
    }
    return (
      `${apiFullUrl('/api/paypal/checkout')}` +
      `?bookingId=${bookingId}&price=${price}&backendUrl=${encodeURIComponent(BACKEND_URL)}`
    );
  }, [bookingId, price]);

  const createBooking = async () => {
    let failureAlreadyReported = false;
    try {
      setIsCreatingBooking(true);

      const response = await fetch(apiFullUrl('/api/appointments'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          service,
          date,
          time,
          barberName,
          base_price: price,
        }),
      });

      let data: any = {};
      try {
        data = (await response.json()) as any;
      } catch (parseErr) {
        console.log("[payment] appointments JSON parse failed:", parseErr);
        throw new Error("Action could not be completed right now. Please try again.");
      }

      const bookingId =
        data?.appointment?.id ??
        (typeof data?.booking === 'object' && data?.booking != null ? (data.booking as { id?: number }).id : undefined);
      if (!response.ok || bookingId == null) {
        if (response.status >= 500) {
          failureAlreadyReported = true;
          reportConnectionFailure({
            kind: 'http',
            url: apiFullUrl("/api/appointments"),
            status: response.status,
            message: data?.message || data?.error,
          });
        }
        throw new Error(data?.message || data?.error || 'Action could not be completed right now. Please try again.');
      }
      setBookingId(String(bookingId));
      setCheckoutReady(true);
      reportConnectionRecovered();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      console.log('[payment] createBooking failed:', rawMessage);
      const looksLikeDevText =
        !rawMessage ||
        /undefined|null|not_found|localhost|127\.0\.0\.1|http:\/\//i.test(rawMessage) ||
        rawMessage.length > 160;
      const message = looksLikeDevText
        ? 'Action could not be completed right now. Please try again.'
        : rawMessage;
      if (!failureAlreadyReported) {
        reportConnectionFailure({
          kind: 'network',
          url: apiFullUrl("/api/appointments"),
          message: rawMessage,
        });
      }
      Alert.alert('Booking', message);
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const resetCheckout = () => {
    setCheckoutReady(false);
    setBookingId(null);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'PAYMENT_SUCCESS':
          // Production-grade: verify on backend before trusting success.
          (async () => {
            try {
              const verifyRes = await fetch(apiFullUrl("/api/paypal/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: msg.bookingId, orderId: msg.orderId, expectedAmount: price }),
              });
              let verifyJson: Record<string, unknown> = {};
              try {
                verifyJson = (await verifyRes.json()) as Record<string, unknown>;
              } catch (parseErr) {
                console.log("[payment] verify JSON parse failed:", parseErr);
                throw new Error("verification_parse_failed");
              }
              if (!verifyRes.ok || !verifyJson?.ok) {
                throw new Error(verifyJson?.error || verifyJson?.status || "verification_failed");
              }
              Alert.alert("✅ Payment Verified", `Booking #${msg.bookingId} is paid.`);
              onSuccess?.(msg.bookingId, msg.orderId);
            } catch (e) {
              Alert.alert(
                "Payment Pending",
                "We captured the payment but could not verify it yet. Please wait a moment and try again."
              );
            }
          })();
          break;
        case 'PAYMENT_ERROR':
          Alert.alert('❌ Payment Failed', 'Something went wrong. Please try again.');
          break;
        case 'PAYMENT_CANCELLED':
          Alert.alert('Payment Cancelled', 'You cancelled the payment.');
          onCancel?.();
          break;
        default:
          break;
      }
    } catch {
      // Non-JSON messages from PayPal SDK internals — ignore
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>✂️ IFCDC Checkout</Text>
      {!checkoutReady || !checkoutUrl ? (
        <ScrollView contentContainerStyle={styles.formContainer}>
          <CardContainer glow>
            <Text style={styles.sectionTitle}>Create Booking</Text>
            <Text style={styles.sectionHint}>Enter details to reserve your chair, then pay securely.</Text>

            <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="rgba(255,255,255,0.45)" style={styles.input} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="phone-pad" style={styles.input} />
            <TextInput value={service} onChangeText={setService} placeholder="Service" placeholderTextColor="rgba(255,255,255,0.45)" style={styles.input} />
            <TextInput value={barberName} onChangeText={setBarberName} placeholder="Barber name" placeholderTextColor="rgba(255,255,255,0.45)" style={styles.input} />
            <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.45)" style={styles.input} />
            <TextInput value={time} onChangeText={setTime} placeholder="HH:MM or 2:30 PM" placeholderTextColor="rgba(255,255,255,0.45)" style={styles.input} />
            <TextInput value={price} onChangeText={setPrice} placeholder="Base price (USD)" placeholderTextColor="rgba(255,255,255,0.45)" keyboardType="decimal-pad" style={styles.input} />

            <GlowButton
              label="Create Booking & Continue"
              onPress={createBooking}
              disabled={isCreatingBooking}
              loading={isCreatingBooking}
            />
          </CardContainer>
        </ScrollView>
      ) : (
        <>
          <View style={styles.checkoutMeta}>
            <Text style={styles.checkoutText}>Booking #{bookingId}</Text>
            <Pressable style={styles.linkButton} onPress={resetCheckout}>
              <Text style={styles.linkButtonText}>New booking</Text>
            </Pressable>
          </View>
          <WebView
            ref={webViewRef}
            source={{ uri: checkoutUrl }}
            style={styles.webview}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#f5c842" />
              </View>
            )}
            setSupportMultipleWindows={false}
            originWhitelist={['*']}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
  },
  formContainer: {
    padding: 20,
    gap: 12,
  },
  header: {
    color: theme.colors.gold,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  checkoutMeta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bg1,
  },
  checkoutText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkButtonText: {
    color: theme.colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg0,
  },
});

export default PaymentScreen;
