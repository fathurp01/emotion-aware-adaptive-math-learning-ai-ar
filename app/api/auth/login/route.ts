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
import { getAuthCookieName, signAuthToken } from '@/lib/auth';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isHttps = (forwardedProto ? forwardedProto === 'https' : request.nextUrl.protocol === 'https:') && !isLocalhost;

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
        { error: 'Invalid email or password' },
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
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return user data (exclude password)
    const { password: _password, ...userWithoutPassword } = user;

    const rememberMe = validatedData.rememberMe === true;
    const expiresIn = rememberMe ? '7d' : '1d';
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24;

    const token = await signAuthToken(
      {
      sub: userWithoutPassword.id,
      role: userWithoutPassword.role,
      learningStyle: userWithoutPassword.learningStyle ?? undefined,
      },
      expiresIn
    );

    const res = NextResponse.json({
      success: true,
      user: userWithoutPassword,
      message: 'Login successful',
    });

    res.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      // IMPORTANT: secure cookies are rejected on plain http. Allow localhost for local prod (`next start`).
      secure: isHttps,
      path: '/',
      maxAge: cookieMaxAge,
    });

    return res;
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
