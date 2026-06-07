/**
 * Get Chapters API Route
 * 
 * GET /api/student/chapters
 * Returns all chapters with their materials
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const chapters = await prisma.chapter.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        materials: {
          select: {
            id: true,
            title: true,
            difficulty: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
