import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieName } from '@/lib/auth';

export async function POST(_request: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: getAuthCookieName(),
    value: '',
    path: '/',
    maxAge: 0,
  });
  return res;
}
