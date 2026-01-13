import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieName, verifyAuthToken } from './lib/auth';

export const config = {
  matcher: [
    '/student/:path*',
    '/teacher/:path*',
    '/api/student/:path*',
    '/api/teacher/:path*',
    '/api/quiz/:path*',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRequest = pathname.startsWith('/api/');

  // Allow auth pages freely
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAuthCookieName())?.value;
  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const payload = await verifyAuthToken(token);

    // Role gating
    if (pathname.startsWith('/teacher')) {
      if (payload.role !== 'TEACHER') {
        if (isApiRequest) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const url = request.nextUrl.clone();
        url.pathname = payload.role === 'STUDENT' ? '/student/dashboard' : '/auth/login';
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith('/api/teacher')) {
      if (payload.role !== 'TEACHER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (pathname.startsWith('/student')) {
      if (payload.role !== 'STUDENT') {
        if (isApiRequest) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const url = request.nextUrl.clone();
        url.pathname = payload.role === 'TEACHER' ? '/teacher/dashboard' : '/auth/login';
        return NextResponse.redirect(url);
      }

      // Onboarding gating: student must set learningStyle
      const isOnboarding = pathname.startsWith('/student/onboarding');
      if (!isOnboarding && !payload.learningStyle) {
        if (isApiRequest) {
          return NextResponse.json({ error: 'Onboarding required' }, { status: 409 });
        }

        const url = request.nextUrl.clone();
        url.pathname = '/student/onboarding';
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith('/api/student') || pathname.startsWith('/api/quiz')) {
      if (payload.role !== 'STUDENT') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.next();
  } catch {
    const res = isApiRequest
      ? NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth/login', request.url));
    res.cookies.set({
      name: getAuthCookieName(),
      value: '',
      path: '/',
      maxAge: 0,
    });
    return res;
  }
}
