/**
 * Login API Route
 * 
 * POST /api/auth/login
 * Authenticates user and returns user data
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        learningStyle: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      validatedData.password,
      user.password
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // Return user data (exclude password)
    const { password, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
