'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TeacherSidebar from '@/components/layout/TeacherSidebar';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';

export default function TeacherShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!authChecked) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (user.role !== 'TEACHER') {
      router.replace('/student/dashboard');
      return;
    }
  }, [hasHydrated, authChecked, user, router]);

  if (!hasHydrated || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <div className="text-sm text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // While redirecting
  if (!user || user.role !== 'TEACHER') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-600">Redirecting...</div>
      </div>
    );
  }

  const title =
    pathname === '/teacher/dashboard'
      ? 'Dashboard'
      : pathname === '/teacher/students'
        ? 'Students'
        : pathname === '/teacher/materials'
          ? 'Materials'
          : pathname === '/teacher/chapters'
            ? 'Chapters'
            : pathname === '/teacher/analytics'
              ? 'Analytics'
              : 'Teacher Portal';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar />
      <main className="flex-1 min-w-0">
        <div className="bg-white border-b">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">{title}</div>
              <div className="text-xs text-gray-600">Logged in as {user.name} ({user.email})</div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
