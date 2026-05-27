import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredAuraMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const KEY_PREFIX = "ifcdc_aura_chat_v1";

function storageKey(userId?: string | null): string {
  const uid = String(userId || "guest").trim() || "guest";
  return `${KEY_PREFIX}:${uid}`;
}

export async function loadAuraChatMessages(userId?: string | null): Promise<StoredAuraMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is StoredAuraMessage =>
        m != null &&
        typeof m === "object" &&
        typeof (m as StoredAuraMessage).id === "string" &&
        ((m as StoredAuraMessage).role === "user" || (m as StoredAuraMessage).role === "assistant") &&
        typeof (m as StoredAuraMessage).content === "string",
    );
  } catch {
    return [];
  }
}

export async function saveAuraChatMessages(
  userId: string | null | undefined,
  messages: StoredAuraMessage[],
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(messages));
}

export async function clearAuraChatMessages(userId?: string | null): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}
