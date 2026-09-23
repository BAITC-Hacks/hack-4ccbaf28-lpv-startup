import { createHash } from "node:crypto";
import type { ModelUsage } from "../domain/types";

interface OpenAIResponse {
  status: string;
  output: {
    type: string;
    name?: string;
    arguments?: string;
    call_id?: string;
    content?: { type: string; text?: string }[];
  }[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: { cached_tokens?: number };
  };
}
interface Cached {
  value: OpenAIResponse;
  until: number;
}
const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<OpenAIResponse>>();
const PRICES: Record<string, [number, number, number]> = {
  "gpt-5.4-nano": [0.2, 0.02, 1.25],
  "gpt-5.4-mini": [0.75, 0.075, 4.5],
};
export const models = () => ({
  fast: process.env.OPENAI_MODEL_FAST || "gpt-5.4-nano",
  reasoning: process.env.OPENAI_MODEL_REASONING || "gpt-5.4-mini",
});

export function estimatedCost(
  model: string,
  input: number,
  output: number,
  cachedInput = 0,
): number | null {
  const price = PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")];
  if (!price) return null;
  return (
    ((input - cachedInput) * price[0] +
      cachedInput * price[1] +
      output * price[2]) /
    1_000_000
  );
}

export async function respond(
  model: string,
  purpose: ModelUsage["purpose"],
  body: Record<string, unknown>,
): Promise<{ response: OpenAIResponse; usage: ModelUsage }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("API_NOT_CONFIGURED");
  const request = {
    model,
    store: false,
    reasoning: { effort: "none" },
    max_output_tokens: 1100,
    ...body,
  };
  const key = createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex");
  const started = Date.now();
  const hit = cache.get(key);
  let reused = false;
  let response: OpenAIResponse;
  if (hit && hit.until > started) {
    response = hit.value;
    reused = true;
  } else {
    const existing = pending.get(key);
    reused = !!existing;
    const job =
      existing ??
      (async () => {
        const result = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(6500),
        });
        if (!result.ok) throw new Error(`PROVIDER_${result.status}`);
        const value = (await result.json()) as OpenAIResponse;
        if (value.status !== "completed" || !Array.isArray(value.output))
          throw new Error("PROVIDER_INCOMPLETE");
        if (cache.size >= 150) cache.delete(cache.keys().next().value!);
        cache.set(key, { value, until: Date.now() + 30 * 60_000 });
        return value;
      })();
    if (!existing) pending.set(key, job);
    try {
      response = await job;
    } finally {
      if (!existing) pending.delete(key);
    }
  }
  const input = reused ? 0 : (response.usage?.input_tokens ?? 0);
  const output = reused ? 0 : (response.usage?.output_tokens ?? 0);
  return {
    response,
    usage: {
      purpose,
      model,
      inputTokens: input,
      outputTokens: output,
      latencyMs: Date.now() - started,
      cached: reused,
      estimatedCostUsd: reused
        ? 0
        : response.usage
          ? estimatedCost(
              model,
              input,
              output,
              response.usage.input_tokens_details?.cached_tokens ?? 0,
            )
          : null,
    },
  };
}

export function outputText(response: OpenAIResponse): string {
  const content = response.output.flatMap((item) => item.content ?? []);
  return content
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
}

export function friendlyProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "PROVIDER_401")
    return "Провайдер не принял API-ключ. Локальный подбор работает.";
  if (message === "PROVIDER_429")
    return "Достигнут лимит API. Показаны объяснения по фактам каталога.";
  if (message === "PROVIDER_404")
    return "Выбранная модель недоступна этому аккаунту. Использован локальный подбор.";
  return "AI сейчас не ответил. Подбор и объяснения построены локально по данным каталога.";
}
