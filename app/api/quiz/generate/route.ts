/**
 * Quiz Generation API Route
 * 
 * POST /api/quiz/generate
 * 
 * This endpoint generates adaptive quiz questions using the configured AI provider
 * (Gemini primary with automatic Mistral fallback when configured)
 * based on material content, student's emotion, and learning style.
 * 
 * Request Body:
 * - materialId: string
 * - userId: string (for context)
 * 
 * Response:
 * - question: QuizQuestion object
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCalculationQuizQuestion } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { errorLogger, logRequest } from '@/lib/logger';
import { decideNextQuizDifficulty } from '@/utils/fuzzyLogic';

// ====================================
// VALIDATION SCHEMA
// ====================================

const generateQuizSchema = z.object({
  materialId: z.string().min(1, 'Material ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  questionIndex: z.number().int().min(1).max(10).default(1),
  lastDurationSeconds: z.number().min(0).max(300).optional(),
  wrongCount: z.number().int().min(0).max(10).optional(),
  previousQuestions: z.array(z.string().min(1)).max(10).optional(),
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
  confidence: z.number().min(0).max(1).default(1.0),
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

// ====================================
// POST HANDLER
// ====================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = generateQuizSchema.parse(body);

    const {
      materialId,
      userId,
      questionIndex,
      lastDurationSeconds,
      wrongCount,
      previousQuestions,
      currentEmotion,
      confidence: _confidence,
    } = validatedData;

    const canonicalEmotion = normalizeEmotionLabel(currentEmotion);

    // Fetch material content from database
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        title: true,
        content: true,
        difficulty: true,
      },
    });

    if (!material) {
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/quiz/generate', duration, 404);
      
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    // Fetch user learning style
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        learningStyle: true,
      },
    });

    if (!user) {
      const duration = Date.now() - startTime;
      logRequest('POST', '/api/quiz/generate', duration, 404);
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Default to VISUAL if no learning style set
    const learningStyle = user.learningStyle || 'VISUAL';

    // Q1 is always a recap/reflection question (token-free; no Gemini).
    if (questionIndex === 1) {
      const hint =
        canonicalEmotion === 'Negative'
          ? 'Tulis poin pentingnya pelan-pelan: definisi, rumus, dan contoh.'
          : undefined;
      const supportiveMessage =
        canonicalEmotion === 'Negative' ? 'Tenang, fokus ke poin-poin utama ya.' : undefined;

      const duration = Date.now() - startTime;
      logRequest('POST', '/api/quiz/generate', duration, 200);
      return NextResponse.json({
        success: true,
        data: {
          questionIndex,
          questionType: 'RECAP',
          question: `Sebutkan apa saja yang kamu pelajari dari materi: "${material.title}". Jelaskan singkat.`,
          expectedAnswer: 'Ringkasan konsep/rumus utama dan contoh singkat.',
          difficulty: 'EASY',
          hint,
          supportiveMessage,
          materialId: material.id,
          materialTitle: material.title,
          materialDifficulty: material.difficulty,
        },
      });
    }

    // Q2-Q10: calculation question, difficulty adapts via fuzzy logic.
    const durationSeconds = lastDurationSeconds ?? 30;
    const wrongSoFar = wrongCount ?? 0;
    const baseDifficulty = decideNextQuizDifficulty({
      durationSeconds,
      wrongCount: wrongSoFar,
    });

    // Existing performance-based adaptation stays the main safety net.
    // We also bias difficulty by emotion:
    // - Positive: challenge with harder questions
    // - Neutral: keep normal/adaptive flow
    // - Negative: lower difficulty
    const struggleDetected =
      wrongSoFar >= 2 ||
      durationSeconds >= 60 ||
      canonicalEmotion === 'Negative';

    const struggleNudge = struggleDetected
      ? 'Sepertinya kamu kesulitan, coba selesaikan ini:'
      : undefined;

    // If struggling (wrong/time/negative), automatically lower difficulty.
    // Otherwise: follow adaptive performance difficulty, with an extra positive bias.
    const targetDifficulty = struggleDetected
      ? 'EASY'
      : canonicalEmotion === 'Positive'
      ? 'HARD'
      : baseDifficulty;

    const quizQuestion = await generateCalculationQuizQuestion(
      material.content,
      canonicalEmotion,
      learningStyle,
      targetDifficulty,
      {
        questionIndex,
        avoidQuestions: previousQuestions,
      }
    );

    // Log successful request
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/quiz/generate', duration, 200);

    // Return the generated question
    return NextResponse.json({
      success: true,
      data: {
        ...quizQuestion,
        questionIndex,
        questionType: 'CALC',
        targetDifficulty,
        struggleNudge,
        materialId: material.id,
        materialTitle: material.title,
        materialDifficulty: material.difficulty,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle validation errors
    if (error instanceof z.ZodError) {
      errorLogger.validation('Quiz generation validation error', error, {
        errors: error.errors,
      });
      logRequest('POST', '/api/quiz/generate', duration, 400);
      
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    errorLogger.ai('Failed to generate quiz', error as Error, {
      requestBody: await request.json().catch(() => ({})),
    });
    logRequest('POST', '/api/quiz/generate', duration, 500);
    
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
