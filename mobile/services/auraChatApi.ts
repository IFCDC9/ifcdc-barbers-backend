import i18n, { currentLanguage } from "../i18n";
import { apiFullUrl } from "../constants/config";

/**
 * Default fallback shown when AURA cannot be reached at all. Translated at
 * call-time via the active i18n language so users always see a localized
 * fallback even when the network is down.
 */
function reconnectMessage(): string {
  try {
    return i18n.t("aura.reconnecting");
  } catch {
    return "AURA is temporarily reconnecting. Please try again in a moment.";
  }
}

/** Legacy export — keep for any callers still importing the constant directly. */
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

/**
 * POST /api/aura/chat — never throws; always returns a conversational reply.
 *
 * Sends the active mobile UI language as a `language` field. The backend may
 * opt into honoring it (preferred), or ignore it (current behavior — falls
 * back to the per-barber language hint). Either way the request is forward-
 * compatible.
 */
export async function sendAuraChatMessage(input: {
  message: string;
  conversationId?: string;
  messages?: AuraChatMessage[];
}): Promise<AuraChatResult> {
  const lang = currentLanguage();
  const body: Record<string, unknown> = {
    message: input.message.trim(),
    conversationId: input.conversationId,
    /** New: localization hint. Server may use this to choose reply language. */
    language: lang,
    locale: lang,
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
        headers: {
          "Content-Type": "application/json",
          /** Forward-compat: backend can also read the language from the header. */
          "Accept-Language": lang,
        },
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

  return { reply: reconnectMessage() };
}
