/**
 * Quiz Log API Route
 * 
 * POST /api/student/quiz-log
 * Saves quiz results to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const quizLogQuerySchema = z.object({
  userId: z.string().min(1),
  materialId: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(50).default(10),
});

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = quizLogQuerySchema.parse({
      userId: searchParams.get('userId'),
      materialId: searchParams.get('materialId') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    });

    const logs = await prisma.quizLog.findMany({
      where: {
        userId: parsed.userId,
        ...(parsed.materialId ? { materialId: parsed.materialId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parsed.take,
      select: { score: true, createdAt: true, materialId: true },
    });

    const scores = logs
      .map((l) => (typeof l.score === 'number' ? l.score : 0))
      .filter((n) => Number.isFinite(n));
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    return NextResponse.json({
      success: true,
      data: {
        avgScore,
        count: logs.length,
        logs,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error fetching quiz logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz logs' },
      { status: 500 }
    );
  }
}
