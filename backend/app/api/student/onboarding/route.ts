/**
 * Student Onboarding API Route
 * 
 * POST /api/student/onboarding
 * 
 * This endpoint processes the learning style questionnaire
 * and updates the user's profile with their learning style.
 * 
 * Request Body:
 * - userId: string
 * - answers: { [questionId: number]: LearningStyle }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getLearningStyle, validateAnswers } from '@/utils/learningStyleAlgo';
import type { QuestionnaireAnswers } from '@/utils/learningStyleAlgo';
import { getAuthCookieName, signAuthToken } from '@/lib/auth';

// ====================================
// VALIDATION SCHEMA
// ====================================

const onboardingSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  answers: z.record(
    z.string(),
    z.enum(['VISUAL', 'AUDITORY', 'KINESTHETIC'])
  ),
});

// ====================================
// POST HANDLER
// ====================================

export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isHttps = (forwardedProto ? forwardedProto === 'https' : request.nextUrl.protocol === 'https:') && !isLocalhost;

    const body = await request.json();
    const validatedData = onboardingSchema.parse(body);

    const { userId, answers } = validatedData;

    // Convert string keys to numbers
    const numericAnswers: QuestionnaireAnswers = Object.entries(answers).reduce(
      (acc, [key, value]) => {
        acc[parseInt(key)] = value;
        return acc;
      },
      {} as QuestionnaireAnswers
    );

    // Validate that all questions are answered
    if (!validateAnswers(numericAnswers)) {
      return NextResponse.json(
        { error: 'All questions must be answered' },
        { status: 400 }
      );
    }

    // Calculate learning style
    const learningStyle = getLearningStyle(numericAnswers);

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        learningStyle,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        learningStyle: true,
      },
    });

    const token = await signAuthToken({
      sub: updatedUser.id,
      role: updatedUser.role,
      learningStyle: updatedUser.learningStyle ?? undefined,
    });

    const res = NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        learningStyle,
      },
      message: 'Onboarding completed successfully',
    });

    res.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (error) {
    console.error('Error processing onboarding:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to complete onboarding',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
