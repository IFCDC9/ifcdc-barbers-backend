import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

export type NotificationDebugState = {
  platform: string;
  isDevice: boolean;
  permissionStatus: Notifications.PermissionStatus | "unknown";
  canAskAgain?: boolean;
  expoPushToken?: string | null;
  error?: string | null;
};

const DEFAULT_CHANNEL_ID = "default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureDefaultNotificationChannelAsync() {
  if (Device.osName !== "Android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

export async function registerForPushNotificationsAsync(): Promise<NotificationDebugState> {
  const state: NotificationDebugState = {
    platform: Device.osName || "unknown",
    isDevice: Device.isDevice,
    permissionStatus: "unknown",
    expoPushToken: null,
    error: null,
  };

  try {
    if (!Device.isDevice) {
      state.error = "Push notifications require a physical device (Expo push tokens are not available on simulators).";
      return state;
    }

    const perms = await Notifications.getPermissionsAsync();
    state.permissionStatus = perms.status;
    state.canAskAgain = perms.canAskAgain;

    if (perms.status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      state.permissionStatus = req.status;
      state.canAskAgain = req.canAskAgain;
    }

    if (state.permissionStatus !== "granted") {
      return state;
    }

    await ensureDefaultNotificationChannelAsync();

    // Prefer projectId when available (newer Expo recommends this).
    const projectId =
      (Constants.easConfig as any)?.projectId
      || (Constants.expoConfig as any)?.extra?.eas?.projectId
      || (Constants.manifest as any)?.extra?.eas?.projectId
      || null;

    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    state.expoPushToken = token.data;
    return state;
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    return state;
  }
}

export function addNotificationListeners(opts: {
  onReceived?: (n: Notifications.Notification) => void;
  onResponse?: (r: Notifications.NotificationResponse) => void;
}) {
  const receivedSub = Notifications.addNotificationReceivedListener((n) => {
    opts.onReceived?.(n);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((r) => {
    opts.onResponse?.(r);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export async function triggerLocalTestNotificationAsync() {
  try {
    await ensureDefaultNotificationChannelAsync();

    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== "granted") {
        throw new Error(
          "Notification permission is required. Enable alerts in your device settings and try again."
        );
      }
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "IFCDC Test Notification",
        body: "Your notification system is working.",
        sound: true,
        data: { kind: "local_test" },
      },
      trigger: null,
    });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : "Could not send test notification.";
    throw new Error(message);
  }
}

