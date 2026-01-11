import { createHash } from 'crypto';
import { aiGenerateText } from '@/lib/gemini';

export type ArTemplate =
  | 'balance_scale'
  | 'number_line'
  | 'graph_2d'
  | 'fraction_blocks'
  | 'algebra_tiles'
  | 'generic_overlay';

export type ArRecipe = {
  version: 1;
  template: ArTemplate;
  title: string;
  shortGoal: string;
  steps: string[];
  overlay?: JsonObject;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export function computeContentVersion(content: string): string {
  return createHash('sha256').update(content ?? '', 'utf8').digest('hex');
}

function stripText(input: string): string {
  return (input || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function audioScriptFallback(title: string, content: string): string {
  const clean = stripText(content);
  const base = clean.length > 0 ? clean : title;
  return base.slice(0, 1400);
}

function inferTemplate(content: string): ArTemplate {
  const t = stripText(content).toLowerCase();
  if (/pecahan|fraction|perbandingan|rasio/.test(t)) return 'fraction_blocks';
  if (/grafik|koordinat|cartesius|gradien|garis lurus|fungsi/.test(t)) return 'graph_2d';
  if (/persamaan|sistem persamaan|spltv|spldv|linear/.test(t)) return 'balance_scale';
  if (/bilangan|garis bilangan|positif|negatif|integer|operasi hitung/.test(t)) return 'number_line';
  if (/faktorisasi|aljabar|variabel|x\b|y\b/.test(t)) return 'algebra_tiles';
  return 'generic_overlay';
}

export function arRecipeFallback(title: string, content: string): ArRecipe {
  const template = inferTemplate(content);
  const clean = stripText(content);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const steps = (sentences.length ? sentences : [clean])
    .filter((s) => s.length >= 12)
    .slice(0, 5)
    .map((s, i) => {
      const lead = i === 0 ? 'Amati' : i === 1 ? 'Coba' : 'Lanjutkan';
      return `${lead}: ${s}`;
    });

  return {
    version: 1,
    template,
    title,
    shortGoal: 'Latihan interaktif singkat dengan kamera + overlay.',
    steps: steps.length ? steps : ['Amati: Baca konsep inti pada teks.', 'Coba: Kerjakan 1 contoh soal.', 'Lanjutkan: Ubah angka pada contoh dan amati perubahan.'],
    overlay: { template },
  };
}

function extractJson(text: string): string {
  const cleaned = String(text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
  return cleaned;
}

export async function generateAudioScript(title: string, content: string): Promise<string> {
  const prompt = [
    'Kamu adalah asisten guru matematika SMP.',
    'Tugas: buat naskah audio (untuk TTS) dari materi berikut.',
    'Aturan:',
    '- Bahasa Indonesia, jelas, ramah, tidak menambah fakta baru.',
    '- Fokus membacakan isi yang ada dengan struktur yang enak didengar.',
    '- Maksimal 1200 karakter.',
    '- Output hanya teks naskah, tanpa markdown, tanpa bullet aneh.',
    '',
    `JUDUL: ${title}`,
    '',
    'MATERI:',
    stripText(content).slice(0, 6000),
  ].join('\n');

  try {
    const out = await aiGenerateText(prompt);
    const cleaned = stripText(out);
    return cleaned.slice(0, 1400) || audioScriptFallback(title, content);
  } catch {
    return audioScriptFallback(title, content);
  }
}

export async function generateArRecipe(title: string, content: string): Promise<ArRecipe> {
  const prompt = [
    'Kamu adalah perancang aktivitas WebAR untuk matematika SMP.',
    'Buat 1 AR recipe berbasis template (bukan 3D bebas).',
    'Pilih salah satu template ini saja:',
    '- balance_scale (untuk persamaan)',
    '- number_line (bilangan/operasi)',
    '- graph_2d (grafik garis lurus sederhana)',
    '- fraction_blocks (pecahan)',
    '- algebra_tiles (variabel/aljabar)',
    '- generic_overlay (fallback)',
    '',
    'Output HARUS JSON valid (tanpa markdown) dengan bentuk:',
    '{"version":1,"template":"...","title":"...","shortGoal":"...","steps":["..."],"overlay":{...}}',
    'Aturan:',
    '- steps 3-6 langkah, kalimat singkat, actionable.',
    '- Jangan menambah konsep yang tidak ada di materi.',
    '',
    `JUDUL: ${title}`,
    '',
    'MATERI:',
    stripText(content).slice(0, 7000),
  ].join('\n');

  try {
    const out = await aiGenerateText(prompt);
    const jsonText = extractJson(out);
    const parsed = JSON.parse(jsonText) as Partial<ArRecipe>;

    const template = parsed.template as ArTemplate | undefined;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.filter((s) => typeof s === 'string') as string[] : [];

    if (!template || !steps.length) {
      return arRecipeFallback(title, content);
    }

    return {
      version: 1,
      template,
      title: typeof parsed.title === 'string' ? parsed.title : title,
      shortGoal: typeof parsed.shortGoal === 'string' ? parsed.shortGoal : 'Latihan interaktif singkat.',
      steps: steps.slice(0, 6),
      overlay: typeof parsed.overlay === 'object' && parsed.overlay ? parsed.overlay : { template },
    };
  } catch {
    return arRecipeFallback(title, content);
  }
}
