/**
 * Quiz Feedback API Route
 * 
 * POST /api/quiz/feedback
 * 
 * This endpoint generates AI feedback for student answers
 * and logs the quiz attempt to the database.
 * 
 * Request Body:
 * - userId: string
 * - materialId: string
 * - question: string
 * - userAnswer: string
 * - expectedAnswer: string
 * - currentEmotion: string
 * 
 * Response:
 * - feedback: QuizFeedback object
 * - quizLogId: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateFeedback } from '@/lib/gemini';

// ====================================
// VALIDATION SCHEMA
// ====================================

const feedbackSchema = z.object({
  userId: z.string().min(1),
  materialId: z.string().min(1),
  questionIndex: z.number().int().min(1).max(6).optional(),
  questionType: z.enum(['RECAP', 'CALC']).optional(),
  durationSeconds: z.number().min(0).max(300).optional(),
  question: z.string().min(1),
  userAnswer: z.string().min(1),
  expectedAnswer: z.coerce.string().min(1),
  currentEmotion: z
    .enum([
      'Negative',
      'Neutral',
      'Positive',
      // legacy
      'Happy',
      'Anxious',
      'Confused',
      'Frustrated',
      'Sad',
      'Surprised',
      'Angry',
      'Fearful',
      'Disgusted',
    ])
    .default('Neutral'),
});

function normalizeEmotionLabel(label: string): 'Negative' | 'Neutral' | 'Positive' {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'positive' || normalized === 'happy') return 'Positive';
  if (normalized === 'neutral') return 'Neutral';
  if (normalized === 'negative') return 'Negative';
  if (
    normalized === 'anxious' ||
    normalized === 'confused' ||
    normalized === 'frustrated' ||
    normalized === 'sad' ||
    normalized === 'angry' ||
    normalized === 'fearful' ||
    normalized === 'disgusted'
  ) {
    return 'Negative';
  }
  if (normalized === 'surprised') return 'Neutral';
  return 'Neutral';
}

function normalizeNumberString(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/,/g, '.')
    .replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function gradeCalc(userAnswer: string, expectedAnswer: string): { isCorrect: boolean; score: number; feedback: string } {
  const user = normalizeNumberString(userAnswer);
  const expected = normalizeNumberString(expectedAnswer);
  if (user === null || expected === null) {
    return {
      isCorrect: false,
      score: 0,
      feedback: 'Jawaban harus berupa angka.',
    };
  }

  const tolerance = 1e-6;
  const isCorrect = Math.abs(user - expected) <= tolerance;
  return {
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? 'Benar.' : `Salah. Jawaban yang diharapkan: ${expectedAnswer}`,
  };
}

function pickKeywords(materialText: string, maxKeywords: number): string[] {
  const stop = new Set([
    'dan',
    'yang',
    'dari',
    'untuk',
    'pada',
    'dengan',
    'atau',
    'adalah',
    'ini',
    'itu',
    'ke',
    'di',
    'sebagai',
    'dalam',
    'jadi',
    'jika',
    'maka',
  ]);

  const words = materialText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([w]) => w);
}

function gradeRecap(userAnswer: string, materialText: string): { isCorrect: boolean; score: number; feedback: string } {
  const answer = userAnswer.toLowerCase();
  const keywords = pickKeywords(materialText, 8);
  const hits = keywords.filter((k) => answer.includes(k)).length;
  const longEnough = userAnswer.trim().length >= 40;

  const isCorrect = hits >= 2 && longEnough;
  const score = isCorrect ? 100 : hits >= 1 && longEnough ? 70 : longEnough ? 50 : 0;

  const feedback = isCorrect
    ? 'Bagus, ringkasannya sudah mencakup poin penting.'
    : 'Coba sebutkan 2–3 poin utama (definisi/rumus) dan 1 contoh singkat.';

  return { isCorrect, score, feedback };
}

// ====================================
// POST HANDLER
// ====================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = feedbackSchema.parse(body);

    const {
      userId,
      materialId,
      questionIndex,
      questionType,
      durationSeconds: _durationSeconds,
      question,
      userAnswer,
      expectedAnswer,
      currentEmotion,
    } = validatedData;

    const canonicalEmotion = normalizeEmotionLabel(currentEmotion);

    // Fetch material content only when needed (recap grading uses keywords)
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { content: true },
    });

    const isRecap = questionType === 'RECAP' || questionIndex === 1;

    const localGraded = isRecap
      ? gradeRecap(userAnswer, material?.content ?? '')
      : gradeCalc(userAnswer, expectedAnswer);

    const encouragement =
      canonicalEmotion === 'Negative'
        ? 'Tenang, kerjakan pelan-pelan ya.'
        : canonicalEmotion === 'Positive'
        ? 'Mantap! Lanjut ya.'
        : 'Lanjut!';

    // AI-driven feedback/scoring (with local fallback for stability)
    let finalIsCorrect = localGraded.isCorrect;
    let finalScore = localGraded.score;
    let finalFeedbackText = localGraded.feedback;

    try {
      const ai = await generateFeedback(
        question,
        userAnswer,
        expectedAnswer,
        canonicalEmotion,
        {
          questionType: isRecap ? 'RECAP' : 'CALC',
          materialText: isRecap ? material?.content ?? '' : undefined,
        }
      );

      // For recap, AI scoring is the primary signal.
      if (isRecap) {
        finalIsCorrect = Boolean(ai.isCorrect);
        finalScore = typeof ai.score === 'number' ? ai.score : finalScore;
      } else {
        // For calc: keep local exact correctness when it is confidently correct;
        // otherwise allow AI to grade expressions/partial credit.
        if (!localGraded.isCorrect) {
          finalIsCorrect = Boolean(ai.isCorrect);
          finalScore = typeof ai.score === 'number' ? ai.score : finalScore;
        }
      }

      if (typeof ai.feedback === 'string' && ai.feedback.trim()) {
        finalFeedbackText = ai.feedback;
      }
    } catch {
      // Keep local grading if AI is unavailable.
    }

    const feedback = {
      isCorrect: finalIsCorrect,
      score: finalScore,
      feedback: finalFeedbackText,
      encouragement,
    };

    // Log quiz attempt to database
    const quizLog = await prisma.quizLog.create({
      data: {
        userId,
        materialId,
        question,
        userAnswer,
        aiFeedback: feedback.feedback,
        score: feedback.score,
        detectedEmotion: canonicalEmotion,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...feedback,
        quizLogId: quizLog.id,
      },
    });
  } catch (error) {
    console.error('Error generating feedback:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate feedback',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
