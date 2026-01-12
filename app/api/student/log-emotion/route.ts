/**
 * Log Emotion API Route
 * 
 * POST /api/student/log-emotion
 * 
 * This endpoint saves emotion detection data to the database.
 * Called automatically by the EmotionCamera component.
 * 
 * Request Body:
 * - userId: string
 * - materialId: string (optional)
 * - emotionLabel: string
 * - confidence: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

// ====================================
// VALIDATION SCHEMA
// ====================================

const logEmotionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  materialId: z.string().optional(),
  emotionLabel: z.string().min(1, 'Emotion label is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
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
  try {
    const body = await request.json();
    const validatedData = logEmotionSchema.parse(body);

    const { userId, materialId, emotionLabel, confidence } = validatedData;
    const canonicalEmotion = normalizeEmotionLabel(emotionLabel);

    // Save to database
    const emotionLog = await prisma.emotionLog.create({
      data: {
        userId,
        materialId: materialId || null,
        emotionLabel: canonicalEmotion,
        confidence,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: emotionLog.id,
        timestamp: emotionLog.timestamp,
      },
    });
  } catch (error) {
    console.error('Error logging emotion:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to log emotion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ====================================
// GET HANDLER - Get emotion history for a user
// ====================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const materialId = searchParams.get('materialId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch recent emotion logs
    const emotionLogs = await prisma.emotionLog.findMany({
      where: {
        userId,
        ...(materialId ? { materialId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        material: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Normalize legacy labels in DB so UI stays consistent (3-class)
    const normalizedLogs = emotionLogs.map((log: any) => ({
      ...log,
      emotionLabel: normalizeEmotionLabel(String(log.emotionLabel ?? '')),
    }));

    // Calculate emotion statistics (always in 3-class canonical space)
    const emotionCounts = normalizedLogs.reduce(
      (acc: Record<'Negative' | 'Neutral' | 'Positive', number>, log: any) => {
        const key = normalizeEmotionLabel(String(log.emotionLabel ?? ''));
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { Negative: 0, Neutral: 0, Positive: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        logs: normalizedLogs,
        statistics: emotionCounts,
        totalLogs: emotionLogs.length,
      },
    });
  } catch (error) {
    console.error('Error fetching emotion logs:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch emotion logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
