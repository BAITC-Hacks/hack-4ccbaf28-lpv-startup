import { z } from "zod";
import type { ModelUsage } from "../domain/types";

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const audioTypes = new Set([
  "audio/webm",
  "video/webm",
  "audio/mp4",
  "video/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
]);
export function validAudio(file: File): boolean {
  return (
    file.size > 0 &&
    file.size <= MAX_AUDIO_BYTES &&
    audioTypes.has(file.type.split(";")[0])
  );
}

/** The recording exists only in memory for this request; never persisted or cached. */
export async function transcribe(
  file: File,
): Promise<{ text: string; usage: ModelUsage }> {
  if (!validAudio(file)) throw new Error("INVALID_AUDIO");
  if (!process.env.OPENAI_API_KEY) throw new Error("API_NOT_CONFIGURED");
  const model = process.env.OPENAI_MODEL_TRANSCRIBE || "gpt-4o-mini-transcribe";
  const body = new FormData();
  body.set("file", file);
  body.set("model", model);
  body.set("response_format", "json");
  const started = Date.now();
  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`PROVIDER_${response.status}`);
  const data = z
    .object({
      text: z.string().trim().min(1).max(1800),
      usage: z
        .object({
          input_tokens: z.number().optional(),
          output_tokens: z.number().optional(),
          input_token_details: z
            .object({
              audio_tokens: z.number().optional(),
              text_tokens: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .parse(await response.json());
  // Audio and text have different prices. Do not apply text-model rates to audio.
  return {
    text: data.text,
    usage: {
      purpose: "transcribe",
      model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - started,
      cached: false,
      estimatedCostUsd: null,
    },
  };
}
