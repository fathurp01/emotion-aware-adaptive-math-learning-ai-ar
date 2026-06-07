/**
 * Student Dashboard Page
 * 
 * Shows list of chapters/materials and emotion statistics
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthChecked, useHasHydrated, useLogout, useUser } from '@/lib/store';
import { BookOpen, Brain, Heart, ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface Chapter {
  id: string;
  title: string;
  description: string;
  materials: Array<{
    id: string;
    title: string;
    difficulty: string;
  }>;
}

interface EmotionStats {
  [key: string]: number;
}

export default function StudentDashboard() {
  const router = useRouter();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const authChecked = useAuthChecked();
  const logout = useLogout();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [emotionStats, setEmotionStats] = useState<EmotionStats>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch chapters and materials
      const chaptersRes = await fetch('/api/student/chapters');
      if (chaptersRes.ok) {
        const chaptersData = await chaptersRes.json();
        setChapters(chaptersData);
      }

      // Fetch emotion statistics
      if (user) {
        const emotionsRes = await fetch(`/api/student/log-emotion?userId=${user.id}&limit=50`);
        if (emotionsRes.ok) {
          const emotionsData = await emotionsRes.json();
          setEmotionStats(emotionsData.data.statistics);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!authChecked) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    fetchData();
  }, [hasHydrated, authChecked, user, router, fetchData]);

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
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.name}!
              </h1>
              <p className="text-gray-600">Learning style: <span className="font-medium text-blue-600">{user?.learningStyle || 'Not set'}</span></p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                } catch {
                  // ignore
                }
                logout();
                router.replace('/auth/login');
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Learning Style</h3>
            </div>
            <p className="text-2xl font-bold text-blue-600">{user?.learningStyle || 'N/A'}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-green-600" />
              <h3 className="font-semibold text-gray-900">Available Materials</h3>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {chapters.reduce((acc, ch) => acc + ch.materials.length, 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="w-8 h-8 text-red-600" />
              <h3 className="font-semibold text-gray-900">Emotion Log</h3>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {Object.values(emotionStats).reduce((a, b) => a + b, 0)}
            </p>
          </div>
        </div>

        {/* Emotion Statistics */}
        {Object.keys(emotionStats).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 border mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Emotion Statistics</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(emotionStats).map(([emotion, count]) => (
                <div key={emotion} className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">{emotion}</div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chapters and Materials */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Learning Materials</h2>
          
          {chapters.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center border">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No materials available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{chapter.title}</h3>
                    <p className="text-gray-600">{chapter.description}</p>
                  </div>
                  <div className="p-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {chapter.materials.map((material) => (
                        <Link
                          key={material.id}
                          href={`/student/learn/${material.id}`}
                          className="group p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {material.title}
                            </h4>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            material.difficulty === 'EASY'
                              ? 'bg-green-100 text-green-700'
                              : material.difficulty === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {material.difficulty}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
