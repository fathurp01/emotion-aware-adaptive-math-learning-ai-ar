'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';
import { AlertTriangle, BarChart3, BookOpen, Loader2, Users } from 'lucide-react';

type Student = {
  id: string;
  name: string;
  email: string;
  emotionLogs: Array<{ emotionLabel: string; confidence: number; timestamp: string }>;
  hasHighAnxiety: boolean;
};

type Material = {
  id: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  refinedAt: string | null;
  updatedAt: string;
  chapter: { id: string; title: string };
};

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();

  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

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

    void (async () => {
      setLoading(true);
      try {
        const [sRes, mRes] = await Promise.all([
          fetch('/api/teacher/students'),
          fetch('/api/teacher/material'),
        ]);

        const sJson = await sRes.json().catch(() => []);
        const mJson = await mRes.json().catch(() => []);

        setStudents(Array.isArray(sJson) ? (sJson as Student[]) : []);
        setMaterials(Array.isArray(mJson) ? (mJson as Material[]) : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [hasHydrated, authChecked, user, router]);

  const riskCount = useMemo(() => students.filter((s) => s.hasHighAnxiety).length, [students]);
  const refinedCount = useMemo(() => materials.filter((m) => Boolean(m.refinedAt)).length, [materials]);

  const emotionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      for (const log of s.emotionLogs || []) {
        const k = String(log.emotionLabel || 'Unknown');
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [students]);

  const topRisk = useMemo(() => {
    return [...students]
      .filter((s) => s.hasHighAnxiety)
      .sort((a, b) => (b.emotionLogs?.length || 0) - (a.emotionLogs?.length || 0))
      .slice(0, 6);
  }, [students]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-7 h-7 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Students</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{students.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-7 h-7 text-red-600" />
            <h3 className="font-semibold text-gray-900">High Risk</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">{riskCount}</p>
          <p className="text-xs text-gray-500 mt-1">Heuristic: &gt;60% negative emotion (last 20 logs)</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-7 h-7 text-green-600" />
            <h3 className="font-semibold text-gray-900">Materials</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{materials.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-7 h-7 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Refined Materials</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">{refinedCount}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Emotion Distribution (Top)</h2>
            <p className="text-gray-600 text-sm">Based on last available emotion log.</p>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-3 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : emotionDistribution.length === 0 ? (
            <div className="p-10 text-center text-gray-600">No emotion data yet.</div>
          ) : (
            <div className="p-6 space-y-3">
              {emotionDistribution.map(([k, v]) => {
                const pct = Math.min(100, Math.round((v / Math.max(1, students.reduce((sum, s) => sum + (s.emotionLogs?.length || 0), 0))) * 100));
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium text-gray-900">{k}</div>
                      <div className="text-gray-600">{v}</div>
                    </div>
                    <div className="mt-1 h-2 rounded bg-gray-100 overflow-hidden">
                      <div className="h-2 bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">High Risk Students</h2>
            <p className="text-gray-600 text-sm">Quick list of students needing attention.</p>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-3 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : topRisk.length === 0 ? (
            <div className="p-10 text-center text-gray-600">No high-risk students.</div>
          ) : (
            <div className="divide-y">
              {topRisk.map((s) => {
                const last = s.emotionLogs?.[0];
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-600">{s.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-700">High Risk</div>
                        <div className="text-xs text-gray-500">{last ? String(last.emotionLabel) : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Note: lightweight analytics for demo. For production, I would add server-side aggregation and better charts.
      </div>
    </div>
  );
}
