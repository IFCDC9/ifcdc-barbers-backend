import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

export async function transcribeAudio(audioBuffer) {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");

  const transcript = await openai.audio.transcriptions.create({
    file: audioBuffer,
    model: "whisper-1"
  });

  return transcript.text;

}
