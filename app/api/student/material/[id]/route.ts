/**
 * Student Material API Route
 * 
 * GET /api/student/material/[id]
 * 
 * Fetch a specific material by ID with chapter information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// ====================================
// GET HANDLER
// ====================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const materialId = params.id;

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
    });

    if (!material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(material);
  } catch (error) {
    console.error('Error fetching material:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch material',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
