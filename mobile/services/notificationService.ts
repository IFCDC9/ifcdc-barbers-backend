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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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

    // Android: ensure a channel exists.
    if (Device.osName === "Android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

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
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "IFCDC Barbers",
      body: "Local notification test",
      data: { kind: "local_test" },
    },
    trigger: { seconds: 1 },
  });
}

