import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateRemedialMarkdown } from '@/lib/remedial';

const getSchema = z.object({
  userId: z.string().min(1),
});

const postSchema = z.object({
  userId: z.string().min(1),
  // Optional context from the latest quiz attempt
  lastAttempt: z
    .object({
      question: z.string().min(1),
      userAnswer: z.string().min(1),
      expectedAnswer: z.string().optional(),
      aiFeedback: z.string().optional(),
      score: z.number().optional(),
    })
    .optional(),
  // Optional emotion override from client/proxy
  emotionLabel: z.enum(['Negative', 'Neutral', 'Positive']).optional(),
  // Optional quick performance context
  wrongCount: z.number().int().min(0).max(50).optional(),
  avgScore: z.number().min(0).max(100).optional(),
});

function asCanonicalEmotion(label: unknown): 'Negative' | 'Neutral' | 'Positive' {
  const normalized = String(label ?? '').trim().toLowerCase();
  if (normalized === 'positive' || normalized === 'happy') return 'Positive';
  if (normalized === 'negative') return 'Negative';
  if (normalized === 'neutral') return 'Neutral';
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

async function getLastEmotionFromDb(userId: string, materialId: string): Promise<'Negative' | 'Neutral' | 'Positive' | null> {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const last = await prisma.emotionLog.findFirst({
    where: {
      userId,
      materialId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'desc' },
    select: { emotionLabel: true },
  });

  if (!last) return null;
  return asCanonicalEmotion(last.emotionLabel);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const materialId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const { userId: validatedUserId } = getSchema.parse({ userId });

    const existing = await prisma.remedialMaterial.findUnique({
      where: { userId_materialId: { userId: validatedUserId, materialId } },
      select: { content: true, updatedAt: true, emotionLabel: true },
    });

    return NextResponse.json({
      success: true,
      data: existing,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch remedial',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const materialId = params.id;
    const body = await request.json();
    const validated = postSchema.parse(body);

    const [material, user] = await Promise.all([
      prisma.material.findUnique({
        where: { id: materialId },
        select: { id: true, title: true, content: true, contentVersion: true },
      }),
      prisma.user.findUnique({
        where: { id: validated.userId },
        select: { id: true, learningStyle: true },
      }),
    ]);

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Emotion source priority: client override -> last emotion from DB -> neutral
    const dbEmotion = await getLastEmotionFromDb(validated.userId, materialId);
    const emotionLabel = validated.emotionLabel ?? dbEmotion ?? 'Neutral';

    // Get a lightweight performance summary from recent quiz logs (fallback if not provided)
    let wrongCount = validated.wrongCount ?? 0;
    let avgScore = validated.avgScore ?? 0;

    if (validated.wrongCount == null || validated.avgScore == null) {
      const recent = await prisma.quizLog.findMany({
        where: { userId: validated.userId, materialId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { score: true },
      });

      if (recent.length) {
        const scores = recent.map((r) => (typeof r.score === 'number' ? r.score : 0));
        avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        wrongCount = scores.filter((s) => s < 80).length;
      }
    }

    const remedial = await generateRemedialMarkdown({
      materialTitle: material.title,
      materialContent: material.content,
      learningStyle: user.learningStyle || 'VISUAL',
      emotionLabel,
      lastAttempt: validated.lastAttempt,
      recentSummary: { wrongCount, avgScore },
    });

    const saved = await prisma.remedialMaterial.upsert({
      where: { userId_materialId: { userId: validated.userId, materialId } },
      create: {
        userId: validated.userId,
        materialId,
        content: remedial,
        emotionLabel,
        basis: {
          materialVersion: material.contentVersion,
          generatedAt: new Date().toISOString(),
          lastAttempt: validated.lastAttempt ?? null,
          recentSummary: { wrongCount, avgScore },
        },
      },
      update: {
        content: remedial,
        emotionLabel,
        basis: {
          materialVersion: material.contentVersion,
          generatedAt: new Date().toISOString(),
          lastAttempt: validated.lastAttempt ?? null,
          recentSummary: { wrongCount, avgScore },
        },
      },
      select: { content: true, updatedAt: true, emotionLabel: true },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Failed to generate remedial',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
