/**
 * Create Material Page (Teacher)
 *
 * Form to create new learning materials with image upload
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/store';
import { ArrowLeft, Upload, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Chapter {
  id: string;
  title: string;
}

export default function CreateMaterialPage() {
  const router = useRouter();
  const user = useUser();

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    chapterId: '',
    content: '',
    difficulty: 'MEDIUM' as 'EASY' | 'MEDIUM' | 'HARD',
    imageFile: null as File | null,
  });

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (user.role !== 'TEACHER') {
      router.push('/student/dashboard');
      return;
    }

    void (async () => {
      try {
        const res = await fetch('/api/teacher/chapters');
        if (res.ok) {
          const data = await res.json();
          setChapters(data);
          if (Array.isArray(data) && data.length > 0) {
            setFormData((prev) => ({ ...prev, chapterId: data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching chapters:', error);
      }
    })();
  }, [user, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      e.currentTarget.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 5MB');
      e.currentTarget.value = '';
      return;
    }

    setFormData((prev) => ({ ...prev, imageFile: file }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.chapterId || !formData.content) {
      toast.error('Harap isi semua field yang wajib');
      return;
    }

    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('chapterId', formData.chapterId);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('difficulty', formData.difficulty);

      if (formData.imageFile) {
        if (!formData.imageFile.type.startsWith('image/')) {
          toast.error('File harus berupa gambar');
          return;
        }
        if (formData.imageFile.size > MAX_IMAGE_BYTES) {
          toast.error('Ukuran gambar maksimal 5MB');
          return;
        }
        formDataToSend.append('image', formData.imageFile);
      }

      const res = await fetch('/api/teacher/material', {
        method: 'POST',
        body: formDataToSend,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to create material');
      }

      toast.success('Materi berhasil dibuat!');
      router.push('/teacher/dashboard');
    } catch (error) {
      console.error('Error creating material:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal membuat materi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/teacher/dashboard"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Buat Materi Baru</h1>
              <p className="text-sm text-gray-600">Tambahkan materi pembelajaran untuk siswa</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Judul Materi *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Contoh: Persamaan Linear"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Chapter Select */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Chapter *
            </label>
            <select
              value={formData.chapterId}
              onChange={(e) => setFormData((prev) => ({ ...prev, chapterId: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {chapters.length === 0 ? (
                <option value="">Belum ada chapter</option>
              ) : (
                chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))
              )}
            </select>

            {chapters.length === 0 && (
              <p className="text-sm text-red-600 mt-1">
                Harap buat chapter terlebih dahulu di database
              </p>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Tingkat Kesulitan *
            </label>
            <div className="flex gap-4">
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={formData.difficulty === level}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        difficulty: e.target.value as 'EASY' | 'MEDIUM' | 'HARD',
                      }))
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Konten Materi *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Tulis konten materi di sini..."
              rows={12}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Konten ini akan digunakan untuk generate quiz AI
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Gambar Ilustrasi (Opsional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {imagePreview ? (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData((prev) => ({ ...prev, imageFile: null }));
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Hapus gambar
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <label className="cursor-pointer text-blue-600 hover:text-blue-700">
                    <span>Pilih gambar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">PNG, JPG, atau GIF (Maks. 5MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <Link
              href="/teacher/dashboard"
              className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={isLoading || chapters.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Simpan Materi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
