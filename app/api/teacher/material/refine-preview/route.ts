import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGenerateTextWithOptions } from '@/lib/gemini';

const schema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

function stripUnsafe(input: string): string {
  return String(input || '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = schema.parse(body);

    const prompt = [
      'Kamu adalah editor materi matematika SMP.',
      'Tugas: rapikan dan susun ulang materi berikut agar jelas untuk siswa.',
      'Aturan:',
      '- Bahasa Indonesia, tidak menambah fakta/konsep baru.',
      '- Hasil dalam format markdown sederhana (judul, subjudul, langkah, contoh, latihan).',
      '- Jangan membuat halusinasi; jika ada bagian kurang jelas, tulis catatan singkat "(Perlu konfirmasi guru)".',
      '- Output hanya markdown, tanpa JSON.',
      '',
      `JUDUL: ${title}`,
      '',
      'MATERI ASLI:',
      stripUnsafe(content).slice(0, 9000),
    ].join('\n');

    const maxTokensRaw = process.env.MATERIAL_REFINE_MAX_OUTPUT_TOKENS;
    const maxOutputTokens = maxTokensRaw ? Number.parseInt(maxTokensRaw, 10) : 1536;

    const refined = await aiGenerateTextWithOptions(prompt, {
      maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1536,
      temperature: 0.2,
    });

    return NextResponse.json({
      success: true,
      refinedContent: stripUnsafe(refined),
    });
  } catch (error) {
    console.error('Refine preview error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to refine content',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
