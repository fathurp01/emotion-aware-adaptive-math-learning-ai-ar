'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';
import { Layers, Loader2 } from 'lucide-react';

type ChapterStat = {
  id: string;
  title: string;
  orderIndex: number;
  updatedAt: string;
  materialCount: number;
};

export default function TeacherChaptersPage() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();

  const [items, setItems] = useState<ChapterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const res = await fetch('/api/teacher/chapters/stats');
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat chapter');
        setItems(Array.isArray(json) ? (json as ChapterStat[]) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat chapter');
      } finally {
        setLoading(false);
      }
    })();
  }, [hasHydrated, authChecked, user, router]);

  const totalMaterials = useMemo(() => items.reduce((sum, c) => sum + (c.materialCount || 0), 0), [items]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-8 h-8 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Chapter</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{items.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-8 h-8 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Materi</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{totalMaterials}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Daftar Chapter</h2>
          <p className="text-gray-600 text-sm">Ringkasan chapter dan jumlah materi di masing-masing chapter.</p>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Memuat...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-600">Belum ada chapter</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urutan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Materi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{c.orderIndex}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{c.title}</div>
                      <div className="text-xs text-gray-500">ID: {c.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{c.materialCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Catatan: pembuatan chapter saat ini lewat database/seed. Kalau kamu mau, saya bisa tambahkan UI “Tambah/Edit Chapter”.
      </div>
    </div>
  );
}
