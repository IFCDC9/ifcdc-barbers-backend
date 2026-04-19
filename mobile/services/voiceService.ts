import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { apiFetch } from "./api";

export type VoiceTurnResult =
  | { ok: true; transcript: string; replyText: string }
  | { ok: false; error: string };

/**
 * Voice pipeline for Expo Go:
 * - We can reliably do TTS (expo-speech).
 * - For STT, react-native-voice requires a dev build; we try to load it dynamically and
 *   fall back to a manual transcript flow when unavailable.
 */
export async function speakAsync(text: string) {
  if (!text?.trim()) return;
  Speech.stop();
  Speech.speak(text, { rate: 1.0, pitch: 1.0 });
}

async function tryGetVoiceModule(): Promise<any | null> {
  try {
    // react-native-voice is not supported in Expo Go; this will throw there.
    const mod = await import("react-native-voice");
    return (mod as any)?.default || mod;
  } catch {
    return null;
  }
}

export async function startListeningOnce(opts?: { timeoutMs?: number }): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const Voice = await tryGetVoiceModule();
  if (!Voice) {
    throw new Error(
      "Speech recognition is unavailable in Expo Go. Create a dev build to use react-native-voice, or provide a typed transcript."
    );
  }

  return await new Promise<string>((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        Voice.stop();
      } catch {
        // ignore
      }
      reject(new Error("Speech recognition timed out"));
    }, timeoutMs);

    Voice.onSpeechResults = (e: any) => {
      const first = Array.isArray(e?.value) ? String(e.value[0] || "") : "";
      if (!first.trim()) return;
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(first);
    };

    Voice.onSpeechError = (e: any) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      reject(new Error(String(e?.error?.message || "speech_error")));
    };

    Voice.start("en-US").catch((err: any) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

export async function voiceTurnFromTextAsync(transcript: string): Promise<VoiceTurnResult> {
  try {
    const clean = String(transcript || "").trim();
    if (!clean) return { ok: false, error: "Empty transcript" };

    console.log("[voice] transcript:", clean);

    const res = await apiFetch("/api/voice/mobile", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ text: clean }),
    });
    const json = (await res.json()) as { ok?: boolean; replyText?: string; error?: string };
    if (!json?.replyText) {
      return { ok: false, error: json?.error || "No reply from server" };
    }

    console.log("[voice] reply:", json.replyText);
    await speakAsync(json.replyText);
    return { ok: true, transcript: clean, replyText: json.replyText };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Optional: record a short snippet (useful later if you add backend STT).
 * Currently does NOT upload audio; it just verifies permissions + recording works.
 */
export async function recordShortProbeAsync(ms: number = 1200) {
  const perms = await Audio.requestPermissionsAsync();
  if (!perms.granted) throw new Error("Microphone permission not granted");

  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const rec = new Audio.Recording();
  await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
  await rec.startAsync();
  await new Promise((r) => setTimeout(r, ms));
  await rec.stopAndUnloadAsync();
  return rec.getURI();
}

