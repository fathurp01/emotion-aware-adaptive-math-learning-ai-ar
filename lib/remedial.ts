import { aiGenerateTextWithOptions } from '@/lib/gemini';

function stripUnsafe(input: string): string {
  return String(input || '').trim();
}

function sanitizeMarkdown(input: string): string {
  let text = stripUnsafe(input);

  // Remove fenced wrappers like ```markdown ... ```
  text = text.replace(/^```\s*markdown\s*/i, '');
  text = text.replace(/^```\s*/i, '');
  text = text.replace(/```\s*$/i, '');

  // Prefer $/$$ delimiters for markdown math parsing.
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n\n$$\n${inner}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`);

  return text.trim();
}

export type RemedialInput = {
  materialTitle: string;
  materialContent: string;
  learningStyle: 'VISUAL' | 'AUDITORY' | 'KINESTHETIC' | string;
  emotionLabel: 'Negative' | 'Neutral' | 'Positive' | string;
  lastAttempt?: {
    question: string;
    userAnswer: string;
    expectedAnswer?: string;
    aiFeedback?: string;
    score?: number;
  };
  recentSummary?: {
    wrongCount: number;
    avgScore: number;
  };
};

function buildRemedialPrompt(input: RemedialInput): string {
  const attempt = input.lastAttempt;
  const summary = input.recentSummary;

  return [
    'Kamu adalah tutor matematika SMP yang adaptif dan suportif.',
    'Tugas: buat materi remedial PERSONAL untuk 1 siswa berdasarkan materi + hasil quiz terakhir.',
    'Tujuan: memperbaiki miskonsepsi, menambah contoh, dan memberi latihan singkat agar siswa cepat paham.',
    '',
    'Aturan output:',
    '- Bahasa Indonesia, ramah, ringkas tapi jelas.',
    '- Format MARKDOWN rapi (judul, ringkasan, langkah, contoh, latihan).',
    '- Jangan menambah konsep di luar materi (kalau butuh, beri catatan "(Perlu konfirmasi guru)").',
    '- Sertakan: 1 ringkasan inti, 1 contoh dikerjakan langkah demi langkah, 2 latihan + kunci singkat.',
    '- Adaptif berdasarkan emosi: jika Negative, beri dukungan + langkah kecil; jika Positive, beri tantangan ringan.',
    '- Adaptif berdasarkan gaya belajar:',
    '  - VISUAL: gunakan tabel/diagram ASCII sederhana bila cocok.',
    '  - AUDITORY: gunakan gaya penjelasan seperti narasi tutor.',
    '  - KINESTHETIC: gunakan aktivitas kecil/eksperimen angka yang bisa dicoba.',
    '- Untuk matematika: gunakan $...$ inline dan $$...$$ blok.',
    '- Output hanya markdown (tanpa JSON, tanpa ```).',
    '',
    `EMOSI (terakhir diketahui): ${input.emotionLabel}`,
    `GAYA BELAJAR: ${input.learningStyle}`,
    summary
      ? `RINGKASAN PERFORMA: wrongCount=${summary.wrongCount}, avgScore=${Math.round(summary.avgScore)}`
      : 'RINGKASAN PERFORMA: (tidak tersedia)',
    '',
    `JUDUL MATERI: ${input.materialTitle}`,
    '',
    'MATERI (ringkas, sumber utama):',
    stripUnsafe(input.materialContent).slice(0, 7000),
    '',
    attempt
      ? [
          'HASIL QUIZ TERAKHIR:',
          `- Pertanyaan: ${stripUnsafe(attempt.question).slice(0, 400)}`,
          `- Jawaban siswa: ${stripUnsafe(attempt.userAnswer).slice(0, 200)}`,
          attempt.expectedAnswer ? `- Jawaban yang diharapkan: ${stripUnsafe(attempt.expectedAnswer).slice(0, 200)}` : '',
          typeof attempt.score === 'number' ? `- Skor: ${attempt.score}` : '',
          attempt.aiFeedback ? `- Feedback sistem: ${stripUnsafe(attempt.aiFeedback).slice(0, 400)}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'HASIL QUIZ TERAKHIR: (tidak tersedia)',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateRemedialMarkdown(input: RemedialInput): Promise<string> {
  const prompt = buildRemedialPrompt(input);
  const out = await aiGenerateTextWithOptions(prompt, {
    maxOutputTokens: 768,
    temperature: 0.2,
  });
  const cleaned = sanitizeMarkdown(out);

  // Safety: ensure we always return something usable
  if (cleaned.length < 200) {
    return [
      `# Remedial: ${input.materialTitle}`,
      '',
      'Maaf, materi remedial belum bisa dibuat otomatis saat ini. Coba ulangi lagi atau minta bantuan guru.',
    ].join('\n');
  }

  return cleaned;
}
