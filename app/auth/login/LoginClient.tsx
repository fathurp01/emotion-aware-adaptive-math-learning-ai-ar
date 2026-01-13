'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEmotionStore, useHasHydrated, useUser } from '@/lib/store';
import { Brain, Loader2, LogIn, AlertCircle } from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setUser = useEmotionStore((state) => state.setUser);
  const user = useUser();
  const hasHydrated = useHasHydrated();

  const nextParam = searchParams.get('next');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) return;

    if (user.role === 'STUDENT') {
      if (!user.learningStyle) router.replace('/student/onboarding');
      else router.replace('/student/dashboard');
    } else {
      router.replace('/teacher/dashboard');
    }
  }, [hasHydrated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save user to Zustand store
      setUser(data.user);

      // Verify cookie-based session is actually established.
      // If cookies are blocked (e.g. secure cookies on http), /me will return 401.
      try {
        const meRes = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!meRes.ok) {
          throw new Error('Session cookie not stored by browser');
        }
      } catch {
        setError('Login berhasil, tapi sesi tidak tersimpan (cookie diblokir). Coba akses via http://localhost:3000 atau jalankan lewat HTTPS untuk production.');
        return;
      }

      // Optional redirect target (middleware sets ?next=/some/path)
      if (nextParam && nextParam.startsWith('/')) {
        if (data.user.role === 'STUDENT' && nextParam.startsWith('/teacher')) {
          // ignore
        } else if (data.user.role === 'TEACHER' && nextParam.startsWith('/student')) {
          // ignore
        } else {
          router.replace(nextParam);
          return;
        }
      }

      // Redirect based on role
      if (data.user.role === 'STUDENT') {
        if (!data.user.learningStyle) {
          router.replace('/student/onboarding');
        } else {
          router.replace('/student/dashboard');
        }
      } else {
        router.replace('/teacher/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Brain className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">EmotionLearn</span>
          </Link>
          <p className="text-gray-600">Masuk ke akun Anda</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Login</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Remember me
              </label>

              <div className="text-xs text-gray-500">
                {rememberMe ? '7 days' : '1 day'} session
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Login
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Belum punya akun?{' '}
            <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Daftar di sini
            </Link>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium mb-2">Demo Credentials:</p>
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Student:</strong> student@demo.com / password</p>
            <p><strong>Teacher:</strong> teacher@demo.com / password</p>
          </div>
        </div>
      </div>
    </div>
  );
}
