/**
 * Material API Route (Teacher)
 * 
 * POST /api/teacher/material
 * Creates new material with optional image upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const materialSchema = z.object({
  title: z.string().min(1),
  chapterId: z.string().min(1),
  content: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const title = formData.get('title') as string;
    const chapterId = formData.get('chapterId') as string;
    const content = formData.get('content') as string;
    const difficulty = formData.get('difficulty') as string;
    const imageFile = formData.get('image') as File | null;

    // Validate input
    const validated = materialSchema.parse({
      title,
      chapterId,
      content,
      difficulty,
    });

    let imageUrl: string | null = null;

    // Handle image upload if present
    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      try {
        await mkdir(uploadsDir, { recursive: true });
      } catch (error) {
        // Directory might already exist, that's fine
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = path.extname(imageFile.name);
      const filename = `material-${timestamp}${extension}`;
      const filepath = path.join(uploadsDir, filename);

      // Save file
      await writeFile(filepath, buffer);
      imageUrl = `/uploads/${filename}`;
    }

    // Create material in database
    const material = await prisma.material.create({
      data: {
        title: validated.title,
        chapterId: validated.chapterId,
        content: validated.content,
        difficulty: validated.difficulty as 'EASY' | 'MEDIUM' | 'HARD',
        imageUrl,
      },
    });

    return NextResponse.json(material);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating material:', error);
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    );
  }
}
