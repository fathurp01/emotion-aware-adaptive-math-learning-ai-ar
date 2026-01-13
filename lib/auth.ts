import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'emotionlearn_session';

export function getAuthCookieName() {
  return COOKIE_NAME;
}

function getSecret() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    '';

  // In production (and during `next build`, which runs with NODE_ENV=production),
  // force a real secret. In dev we allow a fallback for convenience.
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      throw new Error('Missing AUTH_SECRET/JWT_SECRET/NEXTAUTH_SECRET for session signing');
    }
    return new TextEncoder().encode('dev-secret-change-me');
  }

  if (isProd && secret.length < 32) {
    throw new Error('AUTH_SECRET/JWT_SECRET/NEXTAUTH_SECRET must be at least 32 characters in production');
  }

  return new TextEncoder().encode(secret);
}

export type AuthTokenPayload = {
  sub: string;
  role: 'STUDENT' | 'TEACHER';
  learningStyle?: 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';
};

export async function signAuthToken(payload: AuthTokenPayload, expiresIn: string = '7d') {
  return await new SignJWT({ role: payload.role, learningStyle: payload.learningStyle })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const role = payload.role;
  const learningStyle = payload.learningStyle;

  if (!sub) throw new Error('Invalid token subject');
  if (role !== 'STUDENT' && role !== 'TEACHER') throw new Error('Invalid token role');

  return {
    sub,
    role,
    learningStyle:
      learningStyle === 'VISUAL' || learningStyle === 'AUDITORY' || learningStyle === 'KINESTHETIC'
        ? learningStyle
        : undefined,
  } as AuthTokenPayload;
}
