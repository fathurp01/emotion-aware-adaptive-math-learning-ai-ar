/**
 * Quiz Generation API Route
 * 
 * POST /api/quiz/generate
 * 
 * This endpoint generates adaptive quiz questions using Google Gemini AI
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
  questionIndex: z.number().int().min(1).max(6).default(1),
  lastDurationSeconds: z.number().min(0).max(300).optional(),
  wrongCount: z.number().int().min(0).max(10).optional(),
  previousQuestions: z.array(z.string().min(1)).max(6).optional(),
  currentEmotion: z
    .enum(['Neutral', 'Happy', 'Anxious', 'Confused', 'Frustrated', 'Sad', 'Surprised'])
    .default('Neutral'),
  confidence: z.number().min(0).max(1).default(1.0),
});

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
        currentEmotion === 'Anxious'
          ? 'Tulis poin pentingnya pelan-pelan: definisi, rumus, dan contoh.'
          : undefined;
      const supportiveMessage =
        currentEmotion === 'Anxious' ? 'Tenang, fokus ke poin-poin utama ya.' : undefined;

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

    // Q2-Q6: calculation question, difficulty adapts via fuzzy logic.
    const durationSeconds = lastDurationSeconds ?? 30;
    const wrongSoFar = wrongCount ?? 0;
    const baseDifficulty = decideNextQuizDifficulty({
      durationSeconds,
      wrongCount: wrongSoFar,
    });

    const struggleDetected =
      wrongSoFar >= 2 ||
      durationSeconds >= 60 ||
      currentEmotion === 'Anxious' ||
      currentEmotion === 'Confused' ||
      currentEmotion === 'Frustrated' ||
      currentEmotion === 'Sad';

    const struggleNudge = struggleDetected
      ? 'Sepertinya kamu kesulitan, coba selesaikan ini:'
      : undefined;

    // If struggling, automatically lower difficulty. Otherwise keep/raise based on fuzzy decision.
    const targetDifficulty = struggleDetected ? 'EASY' : baseDifficulty;

    const quizQuestion = await generateCalculationQuizQuestion(
      material.content,
      currentEmotion,
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
