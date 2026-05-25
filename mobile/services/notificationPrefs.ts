import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ifcdc_notification_prefs_v1";

export type NotificationPrefs = {
  emailBookingConfirmations: boolean;
  emailReminders: boolean;
  smsEnabled: boolean;
};

const DEFAULTS: NotificationPrefs = {
  emailBookingConfirmations: true,
  emailReminders: true,
  smsEnabled: false,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      emailBookingConfirmations: parsed.emailBookingConfirmations !== false,
      emailReminders: parsed.emailReminders !== false,
      smsEnabled: false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...prefs, smsEnabled: false }));
}
