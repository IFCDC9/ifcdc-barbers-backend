import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ifcdc_admin_platform_notification_prefs_v1";

export type PlatformNotificationPrefs = {
  pushEnabled: boolean;
  smsBroadcastEnabled: boolean;
  emailCampaignEnabled: boolean;
  bookingReminderEnabled: boolean;
};

const DEFAULTS: PlatformNotificationPrefs = {
  pushEnabled: true,
  smsBroadcastEnabled: true,
  emailCampaignEnabled: true,
  bookingReminderEnabled: true,
};

export async function loadPlatformNotificationPrefs(): Promise<PlatformNotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlatformNotificationPrefs>;
    return {
      pushEnabled: parsed.pushEnabled !== false,
      smsBroadcastEnabled: parsed.smsBroadcastEnabled !== false,
      emailCampaignEnabled: parsed.emailCampaignEnabled !== false,
      bookingReminderEnabled: parsed.bookingReminderEnabled !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePlatformNotificationPrefs(prefs: PlatformNotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
