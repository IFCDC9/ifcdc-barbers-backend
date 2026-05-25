import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { calculateFinalBookingTotal } from '../lib/bookingPaymentTotals.js';
import {
  startAppBookingCheckout,
  finalizeAppBookingCheckout,
  fetchAvailableSlots,
  fetchBookingServices,
  pingBookingApi,
  fetchBarbersList,
} from '../services/bookingPayPalApi.js';
import { reportConnectionFailure } from '../services/connectionAlerts';
import { subscribeScheduleUpdated } from '../services/scheduleEvents';
import AppointmentTimeDropdown from '../components/AppointmentTimeDropdown';
import ServicePickerCard from '../components/ServicePickerCard';
import ShareButton from '../components/ShareButton';
import { DEFAULT_BOOKING_SERVICES } from '../lib/defaultBookingServices.js';
import {
  APP_BRAND_NAME,
  buildBookingShareMessage,
} from '../utils/shareContent';

const FALLBACK_SERVICE_PRICE = 25;

function parsePayPalReturnToken(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('token');
  } catch {
    return null;
  }
}

function buildDateOptions(count = 7) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    if (i === 0) options.push('Today');
    else if (i === 1) options.push('Tomorrow');
    else options.push(days[d.getDay()]);
  }
  return options;
}

function BookingScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [barber, setBarber] = useState(null);
  const [date, setDate] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesUsingFallback, setServicesUsingFallback] = useState(false);
  const [servicesLoadKey, setServicesLoadKey] = useState(0);
  const [time, setTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [depositAmount] = useState(0);

  const servicePrice = Number(selectedService?.price);
  const pricing = useMemo(
    () =>
      calculateFinalBookingTotal({
        haircutPrice: Number.isFinite(servicePrice) && servicePrice > 0 ? servicePrice : FALLBACK_SERVICE_PRICE,
        depositAmount,
      }),
    [servicePrice, depositAmount],
  );

  const [successPayload, setSuccessPayload] = useState(null);

  const [barbers, setBarbers] = useState([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [barbersError, setBarbersError] = useState(null);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const dates = useMemo(() => buildDateOptions(7), []);

  useEffect(() => {
    return subscribeScheduleUpdated(() => setScheduleRefreshKey((k) => k + 1));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchBarbersList();
        if (!alive) return;
        const items = list
          .filter((b) => b && b.active !== false)
          .map((b) => ({ id: b.id, name: String(b.name || '').trim() }))
          .filter((b) => b.name);
        setBarbers(items);
        setBarbersError(items.length ? null : 'No barbers available.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[booking] fetch barbers failed:', msg, e?.url);
        if (!alive) return;
        setBarbers([]);
        setBarbersError('Unable to load barbers right now. Please try again.');
        reportConnectionFailure({
          kind: 'network',
          url: e?.url,
          message: msg,
        });
      } finally {
        if (alive) setBarbersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (step !== 5) return;
    let alive = true;
    (async () => {
      try {
        const r = await pingBookingApi();
        if (!alive) return;
        if (r.ok) {
          console.log('[IFCDC] Backend reachable:', r.body);
        } else {
          console.warn('[IFCDC] Backend health check failed:', r.status, r.url, r.body);
        }
      } catch (e) {
        console.warn('[IFCDC] Backend health check error:', e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    let safetyTimer = null;

    const finishLoading = () => {
      if (!cancelled) setServicesLoading(false);
    };

    const applyServices = (list, result) => {
      setServices(list);
      setServicesUsingFallback(Boolean(result?.usedLocalFallback));
      const resolvedId = result?.barberId ?? barber?.id;
      if (resolvedId != null) {
        setBarber((prev) => {
          if (!prev || String(prev.id) === String(resolvedId)) return prev;
          return { ...prev, id: resolvedId };
        });
      }
      setSelectedService((prev) => {
        if (prev && !list.some((s) => String(s.id) === String(prev.id))) return null;
        return prev;
      });
    };

    const load = async () => {
      if (step !== 3 || !barber?.name) return;

      setServicesLoading(true);
      setServicesUsingFallback(false);

      safetyTimer = setTimeout(() => {
        if (cancelled) return;
        console.warn('[services] safety timeout — showing fallback menu');
        applyServices(DEFAULT_BOOKING_SERVICES, { usedLocalFallback: true });
        finishLoading();
      }, 5500);

      try {
        const result = await fetchBookingServices({
          barberId: barber?.id,
          barberName: barber?.name,
        });
        if (cancelled) return;
        const list = result.services?.length ? result.services : DEFAULT_BOOKING_SERVICES;
        applyServices(list, result);
      } catch (e) {
        console.warn('[services] unexpected load error:', e?.message || e);
        if (!cancelled) {
          applyServices(DEFAULT_BOOKING_SERVICES, { usedLocalFallback: true });
        }
      } finally {
        if (safetyTimer) clearTimeout(safetyTimer);
        finishLoading();
      }
    };

    load();
    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [step, barber?.id, barber?.name, servicesLoadKey, scheduleRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (step !== 4 || !barber || !date) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setAvailableSlots([]);
      try {
        const result = await fetchAvailableSlots({
          barberId: barber?.id,
          barberName: barber?.name,
          dateLabel: date,
        });
        if (!cancelled) setAvailableSlots(result.slots || []);
      } catch (e) {
        console.log('available-slots', e);
        if (!cancelled) {
          setAvailableSlots([]);
          setSlotsError('Unable to load available times. Please try again.');
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [step, barber, date, scheduleRefreshKey]);

  const resetFlow = () => {
    setStep(1);
    setBarber(null);
    setDate(null);
    setSelectedService(null);
    setServices([]);
    setServicesUsingFallback(false);
    setServicesLoadKey(0);
    setTime(null);
    setAvailableSlots([]);
    setSlotsError(null);
    setSuccessPayload(null);
    setPhaseLabel('');
  };

  const onConfirmPayAndBook = async () => {
    if (processingPayment || !barber?.name || !date || !time || !selectedService?.id) {
      if (!selectedService?.id) {
        Alert.alert('Select a service', 'Choose a service before completing checkout.');
      }
      return;
    }

    const serviceId = selectedService.id;
    const serviceName = selectedService.name;

    let checkoutSucceeded = false;
    setProcessingPayment(true);
    setPhaseLabel('Processing payment...');

    try {
      setPhaseLabel('Checking time slot…');
      const slotCheck = await fetchAvailableSlots({
        barberId: barber.id,
        barberName: barber.name,
        dateLabel: date,
      });
      const stillOpen = slotCheck.slots?.some((s) => s.available && s.time === time);
      if (!stillOpen) {
        Alert.alert(
          'This time is no longer available.',
          'That slot was just booked. Please go back and choose another time.',
        );
        setStep(4);
        setTime(null);
        setAvailableSlots(slotCheck.slots || []);
        return;
      }

      calculateFinalBookingTotal({
        haircutPrice: Number.isFinite(servicePrice) && servicePrice > 0 ? servicePrice : FALLBACK_SERVICE_PRICE,
        depositAmount,
      });

      const redirectUri = Linking.createURL('paypal-booking/');

      setPhaseLabel('Creating secure checkout...');
      const barberUuid =
        typeof barber?.id === 'string' && barber.id.includes('-') ? barber.id : barber?.uuid;
      const started = await startAppBookingCheckout({
        barberName: barber?.name,
        barberId: barber?.id,
        barberUuid: barberUuid || undefined,
        dateLabel: date,
        timeLabel: time,
        serviceId,
        serviceName,
        redirectUri,
      });

      const { orderId, approveUrl, total, platformFee, haircutPrice, depositAmount: dep } = started;
      if (!orderId || !approveUrl) {
        throw new Error('Server did not return PayPal checkout');
      }

      setPhaseLabel('Complete payment in PayPal…');
      const browser = await WebBrowser.openAuthSessionAsync(approveUrl, redirectUri);

      if (browser.type === 'cancel' || browser.type === 'dismiss') {
        Alert.alert('Payment cancelled', 'You can try again when ready.');
        return;
      }

      let paidOrderId = orderId;
      if (browser.type === 'success' && browser.url) {
        const token = parsePayPalReturnToken(browser.url);
        if (token) paidOrderId = token;
      }

      setPhaseLabel('Verifying booking...');
      const finalized = await finalizeAppBookingCheckout(paidOrderId);
      const b = finalized?.booking;
      if (!b?.id) {
        throw new Error('Server did not return a confirmed booking');
      }

      setSuccessPayload({
        bookingId: b.id,
        barber: b.barberName || barber?.name,
        service: b.service || selectedService?.name,
        date: String(b.date ?? date),
        time: String(b.time ?? time),
        depositPaid: Number(b.depositPaid ?? dep ?? 0),
        remainingBalance: Number(b.remainingBalance ?? 0),
        total: Number(b.total ?? total),
        platformFee: Number(b.platformFee ?? platformFee),
        servicePrice: Number(b.haircutPrice ?? servicePrice),
        captureId: b.captureId,
      });
      setPhaseLabel('Booking confirmed');
      checkoutSucceeded = true;
      setStep(6);
    } catch (err) {
      console.warn('[booking] checkout failed:', err?.message || err, err?.url, err?.status);
      reportConnectionFailure({
        kind: err?.status >= 500 ? 'http' : 'network',
        url: err?.url,
        status: err?.status,
        message: err?.message,
      });
      const rawMsg =
        (err?.message && typeof err.message === 'string' ? err.message : '') ||
        (typeof err === 'string' ? err : '');
      const looksLikeDevText =
        !rawMsg ||
        /undefined|null|not_found|localhost|127\.0\.0\.1|http:\/\//i.test(rawMsg) ||
        rawMsg.length > 160;
      const msg = looksLikeDevText
        ? 'Action could not be completed right now. Please try again.'
        : rawMsg;
      Alert.alert('Checkout', msg);
    } finally {
      setProcessingPayment(false);
      if (!checkoutSucceeded) {
        setPhaseLabel('');
      }
    }
  };

  const bottomPad = Platform.OS === 'ios' ? 28 : 20;
  const openSlotTimes = useMemo(
    () => availableSlots.filter((s) => s.available).map((s) => s.time),
    [availableSlots],
  );
  const hasOpenSlots = openSlotTimes.length > 0;

  if (step === 6 && successPayload) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#000' }}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: bottomPad + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: '#FFD700', fontSize: 26, fontWeight: '700', marginBottom: 8 }}>
            Booking confirmed
          </Text>
          <Text style={{ color: '#888', marginBottom: 20 }}>{phaseLabel}</Text>

          <View
            style={{
              height: 120,
              backgroundColor: '#111',
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#222',
            }}
          >
            <Text style={{ color: '#FFD700', fontSize: 16 }}>✓</Text>
            <Text style={{ color: '#666', marginTop: 8, fontSize: 13 }}>Booking confirmed</Text>
          </View>

          <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: '#fff', marginBottom: 6 }}>
              <Text style={{ color: '#888' }}>Service </Text>
              {successPayload.service || '—'}
            </Text>
            <Text style={{ color: '#fff', marginBottom: 6 }}>
              <Text style={{ color: '#888' }}>Barber </Text>
              {successPayload.barber}
            </Text>
            <Text style={{ color: '#fff', marginBottom: 6 }}>
              <Text style={{ color: '#888' }}>When </Text>
              {successPayload.date} · {successPayload.time}
            </Text>
            <Text style={{ color: '#fff', marginBottom: 6 }}>
              <Text style={{ color: '#888' }}>Deposit paid </Text>$
              {Number(successPayload.depositPaid).toFixed(2)}
            </Text>
            <Text style={{ color: '#fff', marginBottom: 6 }}>
              <Text style={{ color: '#888' }}>Remaining balance </Text>$
              {Number(successPayload.remainingBalance).toFixed(2)}
            </Text>
            <Text style={{ color: '#FFD700', marginTop: 10, fontSize: 18 }}>
              Booking ID{' '}
              <Text style={{ color: '#fff' }}>{successPayload.bookingId || '—'}</Text>
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <ShareButton
              variant="block"
              label="Share booking"
              title={`Booking confirmed · ${APP_BRAND_NAME}`}
              message={buildBookingShareMessage({
                serviceName: successPayload.service,
                barberName: successPayload.barber,
                whenLabel:
                  successPayload.date && successPayload.time
                    ? `${successPayload.date} · ${successPayload.time}`
                    : null,
              })}
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              resetFlow();
              navigation.navigate('Home');
            }}
            style={{
              padding: 16,
              backgroundColor: '#FFD700',
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#000', textAlign: 'center', fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: bottomPad + 72,
          paddingRight: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: '#FFD700', fontSize: 22, marginBottom: 20 }}>Booking</Text>

        {step === 1 && (
          <>
            <Text style={{ color: '#fff', marginBottom: 10 }}>Select Barber</Text>
            {barbersLoading ? (
              <View style={{ alignItems: "center", marginVertical: 16, gap: 8 }}>
                <ActivityIndicator color="#FFD700" />
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Loading…</Text>
              </View>
            ) : null}
            {barbersError ? (
              <Text style={{ color: '#f88', marginBottom: 12 }}>{barbersError}</Text>
            ) : null}
            {barbers.map((b) => (
              <TouchableOpacity
                key={String(b.id || b.name)}
                onPress={() => {
                  setBarber(b);
                  setStep(2);
                }}
                style={styles.rowBtn}
              >
                <Text style={{ color: '#fff' }}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={{ color: '#fff', marginBottom: 10 }}>Select Date</Text>
            {dates.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  setDate(d);
                  setSelectedService(null);
                  setTime(null);
                  setStep(3);
                }}
                style={styles.rowBtn}
              >
                <Text style={{ color: '#fff' }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Barber</Text>
              <Text style={styles.summaryValue}>{barber?.name}</Text>
              <Text style={[styles.summaryLabel, { marginTop: 12 }]}>Date</Text>
              <Text style={styles.summaryValue}>{date}</Text>
            </View>

            <Text style={styles.sectionTitle}>Choose Service</Text>

            {servicesLoading ? (
              <View style={{ alignItems: 'center', marginVertical: 24, gap: 8 }}>
                <ActivityIndicator color="#FFD700" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>Loading services…</Text>
              </View>
            ) : (
              services.map((service) => (
                <ServicePickerCard
                  key={String(service.id)}
                  service={service}
                  selected={String(selectedService?.id) === String(service.id)}
                  onPress={() => setSelectedService(service)}
                />
              ))
            )}

            {!servicesLoading && servicesUsingFallback ? (
              <TouchableOpacity
                onPress={() => setServicesLoadKey((k) => k + 1)}
                style={styles.retryLink}
              >
                <Text style={styles.retryLinkText}>Retry loading services</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              disabled={!selectedService || servicesLoading}
              onPress={() => {
                if (selectedService) {
                  setTime(null);
                  setStep(4);
                }
              }}
              style={[
                styles.continueBtn,
                (!selectedService || servicesLoading) && styles.continueBtnDisabled,
              ]}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(2)} style={styles.backLink}>
              <Text style={styles.backLinkText}>Change date</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 4 && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Barber</Text>
              <Text style={styles.summaryValue}>{barber?.name}</Text>
              <Text style={[styles.summaryLabel, { marginTop: 12 }]}>Date</Text>
              <Text style={styles.summaryValue}>{date}</Text>
              <Text style={[styles.summaryLabel, { marginTop: 12 }]}>Service</Text>
              <Text style={styles.summaryValue}>{selectedService?.name || '—'}</Text>
            </View>

            {slotsLoading ? (
              <View style={{ alignItems: "center", marginVertical: 24, gap: 8 }}>
                <ActivityIndicator color="#FFD700" />
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Loading…</Text>
              </View>
            ) : null}

            {slotsError ? (
              <Text style={styles.errorText}>{slotsError}</Text>
            ) : null}

            {!slotsLoading && !slotsError && !hasOpenSlots ? (
              <Text style={styles.emptyText}>No available times for this date.</Text>
            ) : null}

            {!slotsLoading && hasOpenSlots ? (
              <AppointmentTimeDropdown
                value={time}
                options={openSlotTimes}
                disabled={slotsLoading}
                onSelect={(t) => setTime(t)}
              />
            ) : null}

            <TouchableOpacity
              disabled={!time || slotsLoading}
              onPress={() => {
                if (time) setStep(5);
              }}
              style={[
                styles.continueBtn,
                (!time || slotsLoading) && styles.continueBtnDisabled,
              ]}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(3)} style={styles.backLink}>
              <Text style={styles.backLinkText}>Change service</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 5 && (
          <View>
            <Text style={{ color: '#FFD700', fontSize: 18, marginBottom: 10 }}>Confirm Booking</Text>

            <Text style={{ color: '#fff' }}>Barber: {barber?.name}</Text>
            <Text style={{ color: '#fff' }}>Date: {date}</Text>
            <Text style={{ color: '#fff' }}>Service: {selectedService?.name || '—'}</Text>
            <Text style={{ color: '#fff' }}>Time: {time}</Text>

            <View
              style={{
                marginTop: 20,
                padding: 15,
                backgroundColor: '#111',
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff' }}>
                {selectedService?.name || 'Service'}: ${pricing.haircutPrice.toFixed(2)}
              </Text>
              {pricing.depositAmount > 0 ? (
                <Text style={{ color: '#fff' }}>Deposit: ${pricing.depositAmount.toFixed(2)}</Text>
              ) : null}
              <Text style={{ color: '#FFD700' }}>Platform Fee: ${pricing.platformFee.toFixed(2)}</Text>
              <Text style={{ color: '#fff', marginTop: 10, fontSize: 18 }}>
                Total (charged on PayPal): ${pricing.total.toFixed(2)}
              </Text>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
                Amount is set on the server when you pay — the app does not send totals to PayPal.
              </Text>
            </View>

            {phaseLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                <ActivityIndicator color="#FFD700" style={{ marginRight: 10 }} />
                <Text style={{ color: '#FFD700', flex: 1 }}>{phaseLabel}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              disabled={processingPayment}
              style={{
                marginTop: 20,
                padding: 15,
                backgroundColor: '#FFD700',
                borderRadius: 10,
                opacity: processingPayment ? 0.5 : 1,
              }}
              onPress={onConfirmPayAndBook}
            >
              <Text style={{ color: '#000', textAlign: 'center', fontWeight: '700' }}>
                {processingPayment ? 'Processing…' : `Pay $${pricing.total.toFixed(2)} with PayPal`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep(4)}
              style={{ marginTop: 14, padding: 12 }}
            >
              <Text style={{ color: '#888', textAlign: 'center' }}>Change time</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rowBtn: {
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.2)',
  },
  summaryCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.2)',
    padding: 16,
    marginBottom: 20,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  hintText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  errorText: {
    color: '#f88',
    marginBottom: 12,
    fontSize: 14,
  },
  continueBtn: {
    marginTop: 24,
    padding: 15,
    backgroundColor: '#FFD700',
    borderRadius: 10,
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    color: '#000',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    marginTop: 14,
    padding: 12,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#888',
    fontSize: 14,
  },
  retryLink: {
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    alignItems: 'center',
  },
  retryLinkText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BookingScreen;
