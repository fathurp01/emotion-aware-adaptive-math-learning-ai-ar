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

// ====================================
// POST HANDLER
// ====================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = logEmotionSchema.parse(body);

    const { userId, materialId, emotionLabel, confidence } = validatedData;

    // Save to database
    const emotionLog = await prisma.emotionLog.create({
      data: {
        userId,
        materialId: materialId || null,
        emotionLabel,
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
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch recent emotion logs
    const emotionLogs = await prisma.emotionLog.findMany({
      where: { userId },
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

    // Calculate emotion statistics
    const emotionCounts = emotionLogs.reduce((acc: Record<string, number>, log: any) => {
      acc[log.emotionLabel] = (acc[log.emotionLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: {
        logs: emotionLogs,
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
