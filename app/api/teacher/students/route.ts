/**
 * Get Students API Route
 * 
 * GET /api/teacher/students
 * Returns all students with emotion analysis
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectAnxietyPattern } from '@/utils/fuzzyLogic';

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
      const recentEmotions = student.emotionLogs.map((log: any) => log.emotionLabel);
      const hasHighAnxiety = detectAnxietyPattern(recentEmotions);

      return {
        ...student,
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
