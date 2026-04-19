import * as SecureStore from "expo-secure-store";

const KEY = "ifcdc_auth_token";

export async function setAuthToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEY);
  return token || null;
}

