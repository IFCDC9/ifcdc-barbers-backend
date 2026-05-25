import AsyncStorage from "@react-native-async-storage/async-storage";

const APPLE_PAY_ENABLED_KEY = "ifcdc_payment_apple_pay_enabled_when_ready";

export async function loadApplePayEnabledWhenReady(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(APPLE_PAY_ENABLED_KEY);
  return raw === "1";
}

export async function saveApplePayEnabledWhenReady(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APPLE_PAY_ENABLED_KEY, enabled ? "1" : "0");
}

export async function recordPayPalTestTransaction(): Promise<void> {
  const key = "ifcdc_payment_paypal_last_test";
  await AsyncStorage.setItem(key, new Date().toISOString());
}

export async function loadPayPalLastTestAt(): Promise<string | null> {
  return AsyncStorage.getItem("ifcdc_payment_paypal_last_test");
}
