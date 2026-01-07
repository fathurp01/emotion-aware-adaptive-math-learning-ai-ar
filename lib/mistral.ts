/**
 * Mistral AI Integration (Server-side)
 *
 * Uses Mistral Chat Completions API.
 * Keep this module server-only (do not import in client components).
 */

type MistralChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
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

const mistralModelName = (process.env.MISTRAL_MODEL || 'mistral-small-latest').trim();
const mistralMaxTokens = clampNumber(parseEnvInt('MISTRAL_MAX_TOKENS', 256), 64, 1024);
const mistralTemperature = clampNumber(parseEnvFloat('MISTRAL_TEMPERATURE', 0.2), 0, 1);

export function isMistralConfigured(): boolean {
  return Boolean((process.env.MISTRAL_API_KEY || '').trim());
}

export async function mistralGenerateText(prompt: string): Promise<string> {
  const apiKey = (process.env.MISTRAL_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Mistral API key not configured (MISTRAL_API_KEY).');
  }

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: mistralModelName,
      temperature: mistralTemperature,
      max_tokens: mistralMaxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mistral error (${res.status} ${res.statusText})${body ? `: ${body}` : ''}`);
  }

  const json = (await res.json()) as MistralChatResponse;
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Mistral');
  return text;
}
