import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

const fallbackDetectLanguage = (value = "") => {
  const text = String(value).toLowerCase().trim();

  if (!text) return "en";
  if (/[áéíóúñ¿¡]|\b(hola|gracias|barbero|cita)\b/.test(text)) return "es";
  if (/[àâçéèêëîïôùûüÿœæ]|\b(bonjour|merci|barbier)\b/.test(text)) return "fr";
  if (/[äöüß]|\b(hallo|danke|friseur)\b/.test(text)) return "de";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[ãõç]|\b(olá|obrigado|barbeiro)\b/.test(text)) return "pt";

  return "en";
};

const parseDetectedLanguage = (raw) => {
  if (!raw) return { language: "en" };

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.language) {
      return { language: String(parsed.language).toLowerCase().slice(0, 2) };
    }
  } catch {
    const asCode = String(raw).trim().toLowerCase().slice(0, 2);
    if (asCode) return { language: asCode };
  }

  return { language: "en" };
};

export async function detectLanguage(text) {
  if (!openai) {
    return { language: fallbackDetectLanguage(text) };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Detect the language of the user's message.
Return JSON only in this format:
{"language":"en"}

Use short ISO-style codes like:
en, es, fr, ar, pt, zh, hi
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    return parseDetectedLanguage(completion.choices?.[0]?.message?.content);
  } catch {
    return { language: fallbackDetectLanguage(text) };
  }
}
