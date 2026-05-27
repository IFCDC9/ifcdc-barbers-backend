import { apiFetch } from "./api";

export async function deleteAuraMessageOnServer(messageId: string): Promise<void> {
  await apiFetch(`/api/aura/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
}

export async function clearAuraConversationOnServer(): Promise<void> {
  await apiFetch("/api/aura/messages", { method: "DELETE" });
}
