/**
 * NVIDIA AI Integration (Server-side)
 *
 * Uses NVIDIA OpenAI-compatible API at:
 * https://integrate.api.nvidia.com/v1/chat/completions
 */

type NvidiaChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type NvidiaGenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

const nvidiaModelName = (process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct').trim();
const nvidiaMaxTokens = clampNumber(parseEnvInt('NVIDIA_MAX_TOKENS', 256), 64, 1024);
const nvidiaTemperature = clampNumber(parseEnvFloat('NVIDIA_TEMPERATURE', 0.2), 0, 1);

export function isNvidiaConfigured(): boolean {
  const key = (process.env.NVIDIA_API_KEY || '').trim();
  return Boolean(key && !key.startsWith('your_'));
}

export async function nvidiaGenerateTextWithOptions(
  prompt: string,
  options?: NvidiaGenerateOptions
): Promise<string> {
  const apiKey = (process.env.NVIDIA_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('NVIDIA API key not configured (NVIDIA_API_KEY).');
  }

  const model = (options?.model || nvidiaModelName).trim();
  const temperature = clampNumber(options?.temperature ?? nvidiaTemperature, 0, 1);
  const maxTokens = clampNumber(options?.maxTokens ?? nvidiaMaxTokens, 64, 2048);

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NVIDIA error (${res.status} ${res.statusText})${body ? `: ${body}` : ''}`);
  }

  const json = (await res.json()) as NvidiaChatResponse;
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from NVIDIA');
  return text;
}

export async function nvidiaGenerateText(prompt: string): Promise<string> {
  return await nvidiaGenerateTextWithOptions(prompt);
}
