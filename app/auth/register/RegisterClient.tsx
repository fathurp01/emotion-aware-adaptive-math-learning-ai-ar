/**
 * Register Page (Client)
 *
 * Split into a client component so the route page can wrap
 * useSearchParams() usage in a Suspense boundary for production builds.
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Brain, Loader2, UserPlus, AlertCircle } from 'lucide-react';

export default function RegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') || 'STUDENT';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: defaultRole.toUpperCase() as 'STUDENT' | 'TEACHER',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect to login
      router.push('/auth/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Brain className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">EmotionLearn</span>
          </Link>
          <p className="text-gray-600">Buat akun baru Anda</p>
        </div>

        {/* Register Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Daftar</h2>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daftar sebagai</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'STUDENT' })}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    formData.role === 'STUDENT'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Murid</div>
                  <div className="text-xs text-gray-500 mt-1">Saya ingin belajar</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'TEACHER' })}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    formData.role === 'TEACHER'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">Guru</div>
                  <div className="text-xs text-gray-500 mt-1">Saya ingin mengajar</div>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="email@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Konfirmasi Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Mendaftar...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Daftar
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Sudah punya akun?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Login di sini
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
