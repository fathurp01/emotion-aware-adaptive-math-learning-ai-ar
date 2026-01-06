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
import { generateFeedback } from '@/lib/gemini';
import { prisma } from '@/lib/db';

// ====================================
// VALIDATION SCHEMA
// ====================================

const feedbackSchema = z.object({
  userId: z.string().min(1),
  materialId: z.string().min(1),
  question: z.string().min(1),
  userAnswer: z.string().min(1),
  expectedAnswer: z.string().min(1),
  currentEmotion: z
    .enum(['Neutral', 'Happy', 'Anxious', 'Confused', 'Frustrated', 'Sad', 'Surprised'])
    .default('Neutral'),
});

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
      question,
      userAnswer,
      expectedAnswer,
      currentEmotion,
    } = validatedData;

    // Generate feedback using Gemini AI
    const feedback = await generateFeedback(
      question,
      userAnswer,
      expectedAnswer,
      currentEmotion
    );

    // Log quiz attempt to database
    const quizLog = await prisma.quizLog.create({
      data: {
        userId,
        materialId,
        question,
        userAnswer,
        aiFeedback: feedback.feedback,
        score: feedback.score,
        detectedEmotion: currentEmotion,
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
