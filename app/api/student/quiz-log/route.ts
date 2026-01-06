/**
 * Quiz Log API Route
 * 
 * POST /api/student/quiz-log
 * Saves quiz results to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const quizLogSchema = z.object({
  userId: z.string(),
  materialId: z.string(),
  question: z.string(),
  userAnswer: z.string(),
  aiFeedback: z.string(),
  score: z.number().min(0).max(100),
  detectedEmotion: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = quizLogSchema.parse(body);

    const quizLog = await prisma.quizLog.create({
      data: {
        userId: validated.userId,
        materialId: validated.materialId,
        question: validated.question,
        userAnswer: validated.userAnswer,
        aiFeedback: validated.aiFeedback,
        score: validated.score,
        detectedEmotion: validated.detectedEmotion,
      },
    });

    return NextResponse.json(quizLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating quiz log:', error);
    return NextResponse.json(
      { error: 'Failed to save quiz log' },
      { status: 500 }
    );
  }
}
