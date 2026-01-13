/**
 * Student Sidebar Component
 * 
 * Navigation menu for student dashboard
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, MessageSquare, User, LogOut, Heart } from 'lucide-react';
import { useEmotionStore, useLogout } from '@/lib/store';

interface StudentSidebarProps {
  onLogout?: () => void;
}

export default function StudentSidebar({ onLogout }: StudentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentEmotion } = useEmotionStore();
  const logout = useLogout();

  const handleLogout = () => {
    if (onLogout) return onLogout();
    void (async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {
        // ignore
      }
      logout();
      router.replace('/auth/login');
    })();
  };

  const links = [
    { href: '/student/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/student/learn', icon: BookOpen, label: 'Learn' },
    { href: '/student/quiz', icon: MessageSquare, label: 'Quiz' },
    { href: '/student/profile', icon: User, label: 'Profile' },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-blue-600">AI Learning</h2>
        <p className="text-sm text-gray-600">Student Portal</p>
      </div>

      {/* Emotion Indicator */}
      {currentEmotion && (
        <div className="p-4 m-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Current Emotion</span>
          </div>
          <p className="text-lg font-bold text-blue-600 capitalize">
            {currentEmotion.label}
          </p>
          <p className="text-xs text-gray-600">
            Confidence: {Math.round(currentEmotion.confidence * 100)}%
          </p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(link.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
