/**
 * Chapters Stats API Route (Teacher)
 *
 * GET /api/teacher/chapters/stats
 * Returns chapters with material counts.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const chapters = await prisma.chapter.findMany({
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        updatedAt: true,
        _count: {
          select: { materials: true },
        },
      },
    });

    const payload = chapters.map((c) => ({
      id: c.id,
      title: c.title,
      orderIndex: c.orderIndex,
      updatedAt: c.updatedAt,
      materialCount: c._count.materials,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching chapter stats:', error);
    return NextResponse.json({ error: 'Failed to fetch chapter stats' }, { status: 500 });
  }
}
