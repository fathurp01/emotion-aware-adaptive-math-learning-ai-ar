/**
 * Get Students API Route
 * 
 * GET /api/teacher/students
 * Returns all students with emotion analysis
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectAnxietyPattern } from '@/utils/fuzzyLogic';

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

export async function GET() {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
        learningStyle: true,
        emotionLogs: {
          orderBy: { timestamp: 'desc' },
          take: 20,
          select: {
            emotionLabel: true,
            confidence: true,
            timestamp: true,
          },
        },
      },
    });

    // Analyze anxiety patterns for each student
    const studentsWithAnalysis = students.map((student: any) => {
      const normalizedEmotionLogs = student.emotionLogs.map((log: any) => ({
        ...log,
        emotionLabel: normalizeEmotionLabel(String(log.emotionLabel ?? '')),
      }));

      const recentEmotions = normalizedEmotionLogs.map((log: any) => log.emotionLabel);
      const hasHighAnxiety = detectAnxietyPattern(recentEmotions);

      return {
        ...student,
        emotionLogs: normalizedEmotionLogs,
        hasHighAnxiety,
      };
    });

    return NextResponse.json(studentsWithAnalysis);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
