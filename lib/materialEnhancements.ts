import { createHash } from 'crypto';
import { aiGenerateText } from '@/lib/gemini';
import { z } from 'zod';

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

// ----------------------------
// AR overlay schemas (strict)
// ----------------------------

const zNumber = z.number().finite();

const zLinearEquationABC = z
  .object({
    a: zNumber,
    b: zNumber,
    c: zNumber,
  })
  .strict();

// Represents a 2-variable linear equation: a*x + b*y = c
// System graph: draw one or two equations and highlight intersection if solvable.
const zGraph2dLinearSystemOverlay = z
  .object({
    kind: z.literal('graph_2d_linear_system'),
    eq1: zLinearEquationABC,
    eq2: zLinearEquationABC.optional(),
    xRange: z.tuple([zNumber, zNumber]).optional(),
    yRange: z.tuple([zNumber, zNumber]).optional(),
    showIntersection: z.boolean().optional(),
    showGrid: z.boolean().optional(),
  })
  .strict();

const zBalanceScaleOverlay = z
  .object({
    kind: z.literal('balance_scale_equation'),
    left: z.string().min(1),
    right: z.string().min(1),
    highlight: z.string().optional(),
  })
  .strict();

const zGenericOverlay = z
  .object({
    kind: z.literal('generic'),
    note: z.string().optional(),
  })
  .strict();

const zArOverlay = z.union([zGraph2dLinearSystemOverlay, zBalanceScaleOverlay, zGenericOverlay]);

const zArTemplate = z.enum([
  'balance_scale',
  'number_line',
  'graph_2d',
  'fraction_blocks',
  'algebra_tiles',
  'generic_overlay',
]);

const zArRecipeOutput = z
  .object({
    version: z.literal(1),
    template: zArTemplate,
    title: z.string().min(1).max(200),
    shortGoal: z.string().min(1).max(240),
    steps: z.array(z.string().min(3).max(220)).min(3).max(6),
    overlay: zArOverlay.optional(),
  })
  .strict();

function normalizeOverlay(input: unknown, template: ArTemplate): JsonObject {
  // We keep DB type as JsonObject, but validate & normalize shape.
  const fallback: JsonObject = { kind: 'generic', note: String(template) };

  if (!input || typeof input !== 'object') return fallback;

  const parsed = zArOverlay.safeParse(input);
  if (parsed.success) return parsed.data as unknown as JsonObject;

  // Best-effort: if template suggests a graph but overlay invalid, fallback to generic.
  return fallback;
}

function normalizeRecipe(candidate: Partial<ArRecipe>, fallbackTitle: string): ArRecipe | null {
  const template = candidate.template as ArTemplate | undefined;
  const steps = Array.isArray(candidate.steps)
    ? (candidate.steps.filter((s) => typeof s === 'string') as string[])
    : [];

  if (!template || steps.length < 3) return null;

  const normalized: ArRecipe = {
    version: 1,
    template,
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : fallbackTitle,
    shortGoal:
      typeof candidate.shortGoal === 'string' && candidate.shortGoal.trim()
        ? candidate.shortGoal.trim()
        : 'Latihan interaktif singkat.',
    steps: steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6),
    overlay: normalizeOverlay(candidate.overlay, template),
  };

  // Validate against strict schema (overlay union is strict too)
  const parsed = zArRecipeOutput.safeParse({
    ...normalized,
    overlay: normalized.overlay,
  });
  if (!parsed.success) return null;

  return {
    version: 1,
    template: parsed.data.template,
    title: parsed.data.title,
    shortGoal: parsed.data.shortGoal,
    steps: parsed.data.steps,
    overlay: parsed.data.overlay as unknown as JsonObject,
  };
}

async function aiValidateAndFixArRecipe(
  aiRecipeRaw: unknown,
  systemRecipe: ArRecipe
): Promise<{ ok: true } | { ok: false; corrected?: ArRecipe; reason: string }> {
  const prompt = [
    'Kamu adalah VALIDATOR konfigurasi AR (sangat ketat).',
    'Tugas: bandingkan 2 JSON:',
    '- aiRecipeRaw: hasil AI sebelumnya (mungkin tidak rapi)',
    '- systemRecipe: hasil normalisasi + validasi dari sistem (ini yang akan dipakai renderer).',
    '',
    'Cek:',
    '1) systemRecipe sesuai schema & dapat dirender oleh sistem tanpa error.',
    '2) systemRecipe konsisten dengan maksud aiRecipeRaw (template & overlay tidak bertentangan).',
    '3) Untuk SPLDV/sistem persamaan: jika ada 2 persamaan, gunakan template graph_2d + overlay.kind graph_2d_linear_system, dan isi koefisien eq1/eq2.',
    '',
    'Keluaran HARUS JSON valid TANPA markdown, bentuknya salah satu:',
    '{"status":"ok"}',
    '{"status":"fix","reason":"...","recipe":{...}}',
    '',
    'Schema recipe ketat:',
    '{"version":1,"template":"balance_scale|number_line|graph_2d|fraction_blocks|algebra_tiles|generic_overlay","title":"...","shortGoal":"...","steps":[...],"overlay":{...}}',
    'Schema overlay ketat:',
    '- graph_2d_linear_system: {"kind":"graph_2d_linear_system","eq1":{"a":number,"b":number,"c":number},"eq2":{"a":number,"b":number,"c":number}?,"xRange":[min,max]?,"yRange":[min,max]?,"showIntersection":true?,"showGrid":true?}',
    '- balance_scale_equation: {"kind":"balance_scale_equation","left":"string","right":"string","highlight":"string"?}',
    '- generic: {"kind":"generic","note":"string"?}',
    '',
    'aiRecipeRaw:',
    JSON.stringify(aiRecipeRaw),
    '',
    'systemRecipe:',
    JSON.stringify(systemRecipe),
  ].join('\n');

  const out = await aiGenerateText(prompt);
  const jsonText = extractJson(out);
  const parsed = JSON.parse(jsonText) as { status?: string; reason?: string; recipe?: unknown };

  if (parsed?.status === 'ok') return { ok: true };

  const reason = typeof parsed?.reason === 'string' && parsed.reason.trim()
    ? parsed.reason.trim()
    : 'Validator meminta perbaikan.';

  if (parsed?.status === 'fix' && parsed.recipe) {
    const maybe = normalizeRecipe(parsed.recipe as Partial<ArRecipe>, systemRecipe.title);
    if (maybe) return { ok: false, corrected: maybe, reason };
  }

  return { ok: false, reason };
}

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
  // SPLDV/SPLTV or explicit “sistem persamaan” is best represented as a graph overlay (two lines + intersection)
  if (/sistem persamaan|spldv|spl\s*dv|dua variabel|x\s*dan\s*y/.test(t)) return 'graph_2d';
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
    overlay:
      template === 'balance_scale'
        ? ({ kind: 'balance_scale_equation', left: '…', right: '…' } as unknown as JsonObject)
        : ({ kind: 'generic', note: String(template) } as unknown as JsonObject),
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
  const suggestedTemplate = inferTemplate(content);
  const hint = stripText(content).toLowerCase();
  const looksLikeSystem = /sistem persamaan|spldv|spl\s*dv|dua variabel/.test(hint);
  const basePrompt = [
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
    'PENTING: Output HARUS JSON valid (tanpa markdown).',
    'Struktur WAJIB:',
    '{"version":1,"template":"...","title":"...","shortGoal":"...","steps":["..."],"overlay":{...}}',
    'Aturan:',
    '- steps 3-6 langkah, kalimat singkat, actionable.',
    '- Jangan menambah konsep yang tidak ada di materi.',
    '- overlay HARUS mengikuti schema template berikut (ketat).',
    looksLikeSystem
      ? '- Karena materi mengarah ke SPLDV/sistem persamaan, PILIH template "graph_2d" dan isi overlay "graph_2d_linear_system" dengan eq1 + eq2 jika ada dua persamaan.'
      : '- Jika materi hanya membahas 1 persamaan, kamu boleh pilih balance_scale.',
    '',
    'SCHEMA overlay (ketat):',
    '- graph_2d_linear_system: {"kind":"graph_2d_linear_system","eq1":{"a":number,"b":number,"c":number},"eq2":{"a":number,"b":number,"c":number}?,"xRange":[min,max]?,"yRange":[min,max]?,"showIntersection":true?,"showGrid":true?}',
    '- balance_scale_equation: {"kind":"balance_scale_equation","left":"string","right":"string","highlight":"string"?}',
    '- generic: {"kind":"generic","note":"string"?}',
    '',
    `Saran template (boleh diikuti jika cocok): ${suggestedTemplate}`,
    '',
    `JUDUL: ${title}`,
    '',
    'MATERI:',
    stripText(content).slice(0, 7000),
  ].join('\n');

  const maxAttempts = 3;
  let lastSystem: ArRecipe | null = null;
  let lastRaw: unknown = null;
  let lastReason = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : [
            basePrompt,
            '',
            'CATATAN perbaikan dari validator sebelumnya:',
            lastReason || '(tidak ada)',
            '',
            'Tolong generate ulang JSON yang benar dan sesuai schema.',
          ].join('\n');

    try {
      const out = await aiGenerateText(prompt);
      const jsonText = extractJson(out);
      const parsed = JSON.parse(jsonText) as Partial<ArRecipe>;
      lastRaw = parsed;

      const systemRecipe = normalizeRecipe(parsed, title);
      if (!systemRecipe) {
        lastReason = 'Normalisasi/validasi schema gagal.';
        continue;
      }

      lastSystem = systemRecipe;

      // AI double-check: ensure the normalized config still matches intent & is runnable.
      const verdict = await aiValidateAndFixArRecipe(parsed, systemRecipe);
      if (verdict.ok) return systemRecipe;

      lastReason = verdict.reason;
      if (verdict.corrected) {
        // If validator provided a corrected recipe, re-check schema and accept.
        const correctedVerdict = await aiValidateAndFixArRecipe(verdict.corrected, verdict.corrected);
        if (correctedVerdict.ok) return verdict.corrected;
        lastReason = correctedVerdict.ok ? '' : correctedVerdict.reason;
        lastSystem = verdict.corrected;
      }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : 'Gagal generate AR recipe';
      continue;
    }
  }

  // Final fallback if repeated attempts failed.
  if (lastSystem) return lastSystem;
  if (lastRaw && typeof lastRaw === 'object') {
    const maybe = normalizeRecipe(lastRaw as Partial<ArRecipe>, title);
    if (maybe) return maybe;
  }
  return arRecipeFallback(title, content);
}

export async function generateArExplanation(input: {
  title: string;
  content: string;
  arRecipe: unknown;
}): Promise<string> {
  const { title, content, arRecipe } = input;

  const recipe = (arRecipe && typeof arRecipe === 'object' ? (arRecipe as any) : null) as any | null;
  const template = typeof recipe?.template === 'string' ? recipe.template : 'generic_overlay';
  const overlayKind = typeof recipe?.overlay?.kind === 'string' ? recipe.overlay.kind : undefined;

  const prompt = [
    'Kamu adalah tutor yang menjelaskan tampilan AR kepada pemula (singkat dan padat).',
    'Buat penjelasan 2-4 kalimat dalam Bahasa Indonesia, tanpa bullet, tanpa markdown.',
    'Tujuan: orang yang baru belajar langsung paham apa yang terlihat di AR dan artinya.',
    'Jangan bahas teknis WebXR/camera. Fokus pada makna visualnya.',
    '',
    'Jika template = graph_2d dan overlay.kind = graph_2d_linear_system:',
    '- Jelaskan bahwa dua garis merepresentasikan dua persamaan',
    '- Titik potong = solusi (x,y)',
    '- Sebutkan warna garis merah/biru jika relevan',
    '',
    'Jika template = balance_scale:',
    '- Jelaskan kiri/kanan seimbang sebagai persamaan',
    '- Tujuan menyeimbangkan operasi di kedua sisi',
    '',
    'Jika template = number_line:',
    '- Jelaskan garis bilangan & perpindahan kiri/kanan',
    '',
    'Jika template = fraction_blocks:',
    '- Jelaskan blok pecahan sebagai bagian dari keseluruhan',
    '',
    'Jika template = algebra_tiles:',
    '- Jelaskan ubin mewakili x², x, dan 1 untuk menyusun bentuk aljabar',
    '',
    `Judul materi: ${title}`,
    `Template: ${template}`,
    `Overlay kind: ${overlayKind || '-'}`,
    '',
    'AR recipe JSON:',
    JSON.stringify(arRecipe),
    '',
    'Cuplikan materi (ringkas):',
    stripText(content).slice(0, 1200),
  ].join('\n');

  try {
    const out = await aiGenerateText(prompt);
    const cleaned = stripText(out)
      .replace(/\s+/g, ' ')
      .replace(/^"|"$/g, '')
      .trim();

    if (cleaned.length >= 40) return cleaned.slice(0, 320);
  } catch {
    // ignore
  }

  // Deterministic fallback (no AI)
  if (template === 'graph_2d') {
    return 'Grafik ini menampilkan persamaan sebagai garis. Jika ada dua garis, titik perpotongannya adalah solusi (x,y) yang memenuhi kedua persamaan.';
  }
  if (template === 'balance_scale') {
    return 'Timbangan menggambarkan persamaan: sisi kiri dan kanan harus seimbang. Saat kamu mengubah satu sisi, lakukan hal yang sama pada sisi lain agar tetap setara.';
  }
  if (template === 'number_line') {
    return 'Garis bilangan membantu melihat operasi sebagai pergeseran: ke kanan untuk bertambah dan ke kiri untuk berkurang. Titik akhir menunjukkan hasilnya.';
  }
  if (template === 'fraction_blocks') {
    return 'Blok pecahan menunjukkan bagian dari satu keseluruhan. Bagian yang diwarnai membantu membandingkan dan menyederhanakan pecahan secara visual.';
  }
  if (template === 'algebra_tiles') {
    return 'Ubin aljabar mewakili x², x, dan 1. Dengan menyusun dan mengelompokkan ubin, kamu bisa melihat bentuk aljabar dan penyederhanaannya secara visual.';
  }
  return 'Tampilan AR ini membantu kamu memahami konsep dengan visual sederhana. Ikuti petunjuk yang muncul untuk menghubungkan gambar dengan langkah penyelesaian.';
}
