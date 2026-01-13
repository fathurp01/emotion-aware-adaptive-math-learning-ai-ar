import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthCookieName, verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(getAuthCookieName())?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        learningStyle: true,
      },
    });

    if (!user) {
      const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      res.cookies.set({
        name: getAuthCookieName(),
        value: '',
        path: '/',
        maxAge: 0,
      });
      return res;
    }

    return NextResponse.json({ success: true, user });
  } catch {
    const res = NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    res.cookies.set({
      name: getAuthCookieName(),
      value: '',
      path: '/',
      maxAge: 0,
    });
    return res;
  }
}
