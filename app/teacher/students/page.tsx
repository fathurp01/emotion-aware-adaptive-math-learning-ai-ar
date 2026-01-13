'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';
import { AlertTriangle, Loader2, Search, Users } from 'lucide-react';

type Student = {
  id: string;
  name: string;
  email: string;
  learningStyle: string | null;
  emotionLogs: Array<{ emotionLabel: string; confidence: number; timestamp: string }>;
  hasHighAnxiety: boolean;
};

function labelStyle(style: string | null): { text: string; className: string } {
  if (!style) return { text: 'Belum ditentukan', className: 'bg-gray-100 text-gray-700' };
  const t = style.toUpperCase();
  if (t === 'VISUAL') return { text: 'Visual', className: 'bg-blue-100 text-blue-700' };
  if (t === 'AUDITORY') return { text: 'Auditory', className: 'bg-purple-100 text-purple-700' };
  if (t === 'KINESTHETIC') return { text: 'Kinesthetic', className: 'bg-orange-100 text-orange-700' };
  return { text: style, className: 'bg-gray-100 text-gray-700' };
}

export default function TeacherStudentsPage() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [onlyRisk, setOnlyRisk] = useState(false);

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
      setError(null);
      try {
        const res = await fetch('/api/teacher/students');
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat siswa');
        setStudents(Array.isArray(json) ? (json as Student[]) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat siswa');
      } finally {
        setLoading(false);
      }
    })();
  }, [hasHydrated, authChecked, user, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => (!onlyRisk ? true : s.hasHighAnxiety))
      .filter((s) => {
        if (!q) return true;
        return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
      });
  }, [students, query, onlyRisk]);

  const riskCount = useMemo(() => students.filter((s) => s.hasHighAnxiety).length, [students]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
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
            <h3 className="font-semibold text-gray-900">Risiko Tinggi</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">{riskCount}</p>
          <p className="text-xs text-gray-500 mt-1">&gt;60% emosi terakhir terklasifikasi negatif</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="text-sm font-semibold text-gray-900">Pencarian</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama/email"
                className="w-full pl-9 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />
              Risiko saja
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Daftar Siswa</h2>
          <p className="text-gray-600 text-sm">Cari siswa, lihat gaya belajar, jumlah log emosi, dan status risiko.</p>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Memuat...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-600">Tidak ada siswa yang cocok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gaya Belajar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emosi Terakhir</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((s) => {
                  const style = labelStyle(s.learningStyle);
                  const last = s.emotionLogs?.[0];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{s.name}</span>
                          {s.hasHighAnxiety ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Risiko Tinggi
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">ID: {s.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{s.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${style.className}`}>{style.text}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        {last ? (
                          <div>
                            <div className="font-medium">{String(last.emotionLabel)}</div>
                            <div className="text-xs text-gray-500">{new Date(last.timestamp).toLocaleString()}</div>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.hasHighAnxiety ? (
                          <span className="text-red-600 font-medium">Butuh Perhatian</span>
                        ) : (
                          <span className="text-green-600 font-medium">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
