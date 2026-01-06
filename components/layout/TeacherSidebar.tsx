/**
 * Teacher Sidebar Component
 * 
 * Navigation menu for teacher dashboard
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, BarChart3, Plus, LogOut } from 'lucide-react';

interface TeacherSidebarProps {
  onLogout?: () => void;
}

export default function TeacherSidebar({ onLogout }: TeacherSidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: '/teacher/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/teacher/students', icon: Users, label: 'Siswa' },
    { href: '/teacher/materials', icon: BookOpen, label: 'Materi' },
    { href: '/teacher/analytics', icon: BarChart3, label: 'Analitik' },
  ];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-blue-600">AI Learning</h2>
        <p className="text-sm text-gray-600">Teacher Portal</p>
      </div>

      {/* Quick Action */}
      <div className="p-4">
        <Link
          href="/teacher/materials/create"
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Buat Materi</span>
        </Link>
      </div>

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
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
