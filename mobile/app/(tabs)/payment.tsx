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

// ✏️ Change this to your ngrok / production URL when testing on a real device
const BACKEND_URL = 'http://localhost:3000';

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
  const [name, setName] = useState('Test User');
  const [phone, setPhone] = useState('5551234567');
  const [service, setService] = useState('Haircut');
  const [date, setDate] = useState('2026-03-24');
  const [time, setTime] = useState('13:00');
  const [price, setPrice] = useState('25.00');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);

  const checkoutUrl = useMemo(() => {
    if (!bookingId) {
      return null;
    }

    return (
      `${BACKEND_URL}/api/paypal/checkout` +
      `?bookingId=${bookingId}&price=${price}&backendUrl=${encodeURIComponent(BACKEND_URL)}`
    );
  }, [bookingId, price]);

  const createBooking = async () => {
    try {
      setIsCreatingBooking(true);

      const response = await fetch(`${BACKEND_URL}/api/bookings/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          service,
          date,
          time,
        }),
      });

      const data = (await response.json()) as BookingResponse;

      if (!response.ok || !data.booking?.id) {
        throw new Error(data.error || 'Booking creation failed');
      }

      const { booking } = data;
      const bookingId = booking.id;
      setBookingId(String(bookingId));
      setCheckoutReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Booking creation failed';
      Alert.alert('Booking Failed', message);
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
          Alert.alert('✅ Payment Confirmed', `Booking #${msg.bookingId} is all set!`);
          onSuccess?.(msg.bookingId, msg.orderId);
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
          <Text style={styles.sectionTitle}>Create Booking</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor="#777" style={styles.input} />
          <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#777" keyboardType="phone-pad" style={styles.input} />
          <TextInput value={service} onChangeText={setService} placeholder="Service" placeholderTextColor="#777" style={styles.input} />
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#777" style={styles.input} />
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor="#777" style={styles.input} />
          <TextInput value={price} onChangeText={setPrice} placeholder="Price" placeholderTextColor="#777" keyboardType="decimal-pad" style={styles.input} />

          <Pressable style={styles.primaryButton} onPress={createBooking} disabled={isCreatingBooking}>
            {isCreatingBooking ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Booking & Continue</Text>
            )}
          </Pressable>
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
    backgroundColor: '#0a0a0a',
  },
  formContainer: {
    padding: 20,
    gap: 12,
  },
  header: {
    color: '#f5c842',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#161616',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#f5c842',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
  },
  checkoutMeta: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkButtonText: {
    color: '#f5c842',
    fontSize: 14,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
});

export default PaymentScreen;
