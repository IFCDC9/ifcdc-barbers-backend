import OpenAI from "openai";
import { detectEmotion } from "./emotionEngine.js";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

export async function generateReply(text) {

  const emotion = detectEmotion(text);

  let systemPrompt = `
You are a friendly barbershop receptionist.
`;

  if (emotion === "frustrated") {
    systemPrompt += `
Respond calmly and reassure the caller.
`;
  }

  if (emotion === "happy") {
    systemPrompt += `
Respond in an upbeat friendly tone.
`;
  }

  if (emotion === "neutral") {
    systemPrompt += `
Keep a relaxed conversational tone.
`;
  }

  let speechStyle = "normal";

  if (emotion === "frustrated") {
    speechStyle = "slow";
  }

  if (emotion === "happy") {
    speechStyle = "energetic";
  }

  const completion = await openai.chat.completions.create({

    model: "gpt-4o-mini",

    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: text
      }
    ]

  });

  return completion.choices[0].message.content;

}
