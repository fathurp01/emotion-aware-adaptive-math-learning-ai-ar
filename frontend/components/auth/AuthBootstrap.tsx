'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthChecked, useEmotionStore, useHasHydrated, useUser } from '@/lib/store';

export default function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();

  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();
  const user = useUser();
  const setUser = useEmotionStore((s) => s.setUser);
  const setAuthChecked = useEmotionStore((s) => s.setAuthChecked);

  useEffect(() => {
    if (!hasHydrated) return;
    if (authChecked) return;

    // If we already have a user from persisted state, treat auth as checked.
    if (user) {
      setAuthChecked(true);
      return;
    }

    void (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.user) setUser(data.user);
        }
      } catch {
        // ignore
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [authChecked, hasHydrated, setAuthChecked, setUser, user]);

  // If user is not logged in, and they are on a protected route, redirect once auth check finished.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!authChecked) return;

    const isProtected = pathname?.startsWith('/student') || pathname?.startsWith('/teacher');
    const isAuthPage = pathname?.startsWith('/auth');

    if (!user && isProtected) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/')}`);
      return;
    }

    // If already logged-in and user visits /auth/login manually, send them to their dashboard.
    if (user && isAuthPage) {
      if (user.role === 'TEACHER') router.replace('/teacher/dashboard');
      else if (!user.learningStyle) router.replace('/student/onboarding');
      else router.replace('/student/dashboard');
    }
  }, [authChecked, hasHydrated, pathname, router, user]);

  return null;
}
