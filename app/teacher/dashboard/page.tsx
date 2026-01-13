/**
 * Teacher Dashboard Page
 * 
 * Shows list of students with anxiety indicators
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useLogout, useUser } from '@/lib/store';
import { Users, AlertTriangle, BookOpen, Plus, LogOut } from 'lucide-react';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  email: string;
  learningStyle: string | null;
  emotionLogs: Array<{
    emotion: string;
    confidence: number;
    createdAt: Date;
  }>;
  hasHighAnxiety: boolean;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();
  const logout = useLogout();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!authChecked) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (user.role !== 'TEACHER') {
      router.push('/student/dashboard');
      return;
    }

    fetchStudents();
  }, [hasHydrated, authChecked, user, router]);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/teacher/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-gray-600">Selamat datang, {user?.name}!</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/teacher/materials/create"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Buat Materi
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Total Siswa</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">{students.length}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h3 className="font-semibold text-gray-900">Siswa Berisiko</h3>
            </div>
            <p className="text-3xl font-bold text-red-600">
              {students.filter((s) => s.hasHighAnxiety).length}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-900">Aksi</h3>
            </div>
            <Link
              href="/teacher/materials/create"
              className="text-green-600 hover:underline"
            >
              Tambah Materi →
            </Link>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Daftar Siswa</h2>
            <p className="text-gray-600 text-sm">
              Siswa dengan badge merah memiliki frekuensi kecemasan tinggi
            </p>
          </div>

          {students.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Belum ada siswa terdaftar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gaya Belajar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Log Emosi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{student.name}</span>
                          {student.hasHighAnxiety && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Risiko Tinggi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {student.learningStyle || 'Belum ditentukan'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {student.emotionLogs.length} log
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.hasHighAnxiety ? (
                          <span className="text-red-600 font-medium">Butuh Perhatian</span>
                        ) : (
                          <span className="text-green-600 font-medium">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
