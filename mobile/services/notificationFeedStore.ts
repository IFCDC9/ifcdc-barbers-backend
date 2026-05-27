import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationFeedItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

const KEY = "ifcdc_notification_feed_v1";

export async function loadNotificationFeed(): Promise<NotificationFeedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NotificationFeedItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveNotificationFeed(items: NotificationFeedItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
}

export async function appendNotificationFeed(item: Omit<NotificationFeedItem, "id" | "createdAt">) {
  const items = await loadNotificationFeed();
  const next: NotificationFeedItem = {
    id: `n-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...item,
  };
  await saveNotificationFeed([next, ...items]);
}

export async function removeNotificationFeedItem(id: string): Promise<void> {
  const items = await loadNotificationFeed();
  await saveNotificationFeed(items.filter((i) => i.id !== id));
}

export async function clearNotificationFeed(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
