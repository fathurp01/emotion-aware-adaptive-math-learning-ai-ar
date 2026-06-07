/**
 * Teacher Dashboard Page
 * 
 * Shows list of students with anxiety indicators
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';
import { Users, AlertTriangle, BookOpen, BarChart3 } from 'lucide-react';
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

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [materialsCount, setMaterialsCount] = useState<number>(0);
  const [refinedCount, setRefinedCount] = useState<number>(0);

  const riskCount = useMemo(() => students.filter((s) => s.hasHighAnxiety).length, [students]);

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
    void fetchMaterialsSummary();
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

  const fetchMaterialsSummary = async () => {
    try {
      const res = await fetch('/api/teacher/material');
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      const items = Array.isArray(data) ? data : [];
      setMaterialsCount(items.length);
      setRefinedCount(items.filter((m: any) => Boolean(m?.refinedAt)).length);
    } catch {
      // ignore
    }
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
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Total Students</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">{students.length}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h3 className="font-semibold text-gray-900">At-Risk Students</h3>
            </div>
            <p className="text-3xl font-bold text-red-600">{riskCount}</p>
            <p className="text-xs text-gray-500 mt-1">Heuristic: &gt;60% negative emotion (last 20 logs)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-900">Materials</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">{materialsCount}</p>
            <p className="text-xs text-gray-500 mt-1">Refine/Published: {refinedCount}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Quick Links</h3>
            </div>
            <div className="flex flex-col gap-1">
              <Link href="/teacher/students" className="text-purple-700 hover:underline">
                Manage students →
              </Link>
              <Link href="/teacher/materials" className="text-purple-700 hover:underline">
                Manage materials →
              </Link>
              <Link href="/teacher/analytics" className="text-purple-700 hover:underline">
                View analytics →
              </Link>
            </div>
          </div>
        </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Student Summary</h2>
              <p className="text-gray-600 text-sm">View full details in &apos;Students&apos; menu.</p>
            </div>
            <Link
              href="/teacher/students"
              className="text-sm text-blue-700 hover:underline"
            >
              Open Students page →
            </Link>
          </div>
        </div>

          {students.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No students registered</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Learning Style
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Emotion Logs
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
                              High Risk
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {student.learningStyle || 'Not set'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {student.emotionLogs.length} log
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.hasHighAnxiety ? (
                          <span className="text-red-600 font-medium">Needs Attention</span>
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
  );
}
