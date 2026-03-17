import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

export async function detectEmotion(text) {
  if (!openai) {
    return { emotion: "calm" };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are analyzing customer speech for emotional tone.
Return JSON with one field: emotion.
Possible values: calm, rushed, frustrated, confused.
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return { emotion: "calm" };
  }
}
