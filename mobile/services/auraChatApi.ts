import { apiFullUrl } from "../constants/config";

export const AURA_RECONNECT_MESSAGE =
  "AURA is temporarily reconnecting. Please try again in a moment.";

export type AuraChatMessage = { role: "user" | "assistant"; content: string };

export type AuraChatResult = {
  reply: string;
  action?: string;
};

type AuraChatResponse = {
  success?: boolean;
  message?: string;
  reply?: string;
  action?: string;
};

/** POST /api/aura/chat — never throws; always returns a conversational reply. */
export async function sendAuraChatMessage(input: {
  message: string;
  conversationId?: string;
  messages?: AuraChatMessage[];
}): Promise<AuraChatResult> {
  const body: Record<string, unknown> = {
    message: input.message.trim(),
    conversationId: input.conversationId,
  };
  if (input.messages?.length) {
    body.messages = input.messages;
  }

  const paths = ["/api/aura/chat", "/api/ai/chat", "/api/aura"];

  for (const path of paths) {
    const url = apiFullUrl(path);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 404) {
        continue;
      }

      let json: AuraChatResponse = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        json = (await res.json()) as AuraChatResponse;
      } else {
        console.log("[aura] non-json response", res.status, url);
        continue;
      }

      const reply = String(json.message || json.reply || "").trim();
      if (reply) {
        return {
          reply,
          action: typeof json.action === "string" ? json.action : undefined,
        };
      }
    } catch (e) {
      console.log("[aura] network", url, e instanceof Error ? e.message : String(e));
    }
  }

  return { reply: AURA_RECONNECT_MESSAGE };
}
