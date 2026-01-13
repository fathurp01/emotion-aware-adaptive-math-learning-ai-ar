/**
 * Teacher Materials List Page
 *
 * Shows all materials with lightweight metadata and a quick preview.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Eye, Loader2, Plus, X } from 'lucide-react';
import { useAuthChecked, useHasHydrated, useUser } from '@/lib/store';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

type MaterialListItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  difficulty: Difficulty;
  refinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  chapter: { id: string; title: string };
};

type MaterialDetail = MaterialListItem & {
  content: string;
};

function difficultyLabel(d: Difficulty): { text: string; className: string } {
  if (d === 'EASY') return { text: 'Mudah', className: 'bg-green-100 text-green-700' };
  if (d === 'HARD') return { text: 'Sulit', className: 'bg-red-100 text-red-700' };
  return { text: 'Sedang', className: 'bg-yellow-100 text-yellow-700' };
}

export default function TeacherMaterialsPage() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();

  const [items, setItems] = useState<MaterialListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MaterialDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
        const res = await fetch('/api/teacher/material');
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat materi');
        setItems(Array.isArray(json) ? (json as MaterialListItem[]) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat materi');
      } finally {
        setLoading(false);
      }
    })();
  }, [hasHydrated, authChecked, user, router]);

  useEffect(() => {
    if (!previewId) {
      setPreview(null);
      return;
    }
    void (async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/teacher/material?id=${encodeURIComponent(previewId)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || 'Gagal memuat detail materi');
        setPreview(json as MaterialDetail);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [previewId]);

  const stats = useMemo(() => {
    const total = items.length;
    const refined = items.filter((m) => Boolean(m.refinedAt)).length;
    return { total, refined };
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Daftar Materi</h1>
              <p className="text-gray-600">Kelola materi untuk siswa</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Kembali
              </Link>
              <Link
                href="/teacher/materials/create"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Buat Materi
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Total Materi</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-900">Sudah Refine</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.refined}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Materi</h2>
            <p className="text-gray-600 text-sm">Klik “Preview” untuk melihat isi materi.</p>
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-3 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Memuat...
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Belum ada materi</p>
              <Link
                href="/teacher/materials/create"
                className="inline-flex mt-4 items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Buat Materi Pertama
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kesulitan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((m) => {
                    const diff = difficultyLabel(m.difficulty);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{m.title}</div>
                          <div className="text-xs text-gray-500">ID: {m.id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">{m.chapter?.title || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${diff.className}`}>{diff.text}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {m.refinedAt ? (
                            <span className="text-green-700 font-medium">Refine/Published</span>
                          ) : (
                            <span className="text-gray-600 font-medium">Draft</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setPreviewId(m.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </button>
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

      {previewId ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-lg border shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold text-gray-900">Preview Materi</div>
              <button
                onClick={() => setPreviewId(null)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {previewLoading ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memuat detail...
                </div>
              ) : preview ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{preview.title}</div>
                    <div className="text-sm text-gray-600">Chapter: {preview.chapter?.title || '—'}</div>
                  </div>
                  <div className="max-h-[60vh] overflow-auto rounded-md border bg-gray-50 p-3">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">{preview.content}</pre>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">Gagal memuat preview.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
