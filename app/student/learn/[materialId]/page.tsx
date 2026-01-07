/**
 * Student Learning Page - Material View with Adaptive UI
 * 
 * This is the CRITICAL page where emotion-aware adaptive learning happens.
 * 
 * Features:
 * - Real-time emotion detection via camera
 * - Adaptive UI based on fuzzy logic (background color, text, hints)
 * - Dynamic content simplification for anxious students
 * - Breathing exercise prompts for high anxiety
 * - Progress tracking
 * 
 * Layout:
 * - Left: Material content (adaptive)
 * - Right: Camera (small, optional)
 * - Bottom: Navigation & Actions
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentEmotion, useUser } from '@/lib/store';
import { applyFuzzyLogic, getEncouragementMessage } from '@/utils/fuzzyLogic';
import type { FuzzyOutputs } from '@/utils/fuzzyLogic';
import EmotionCamera from '@/components/ai/EmotionCamera';
import AdaptiveText from '@/components/ui/AdaptiveText';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Heart } from 'lucide-react';
import { toast } from 'sonner'; // Install: npm install sonner

// ====================================
// TYPE DEFINITIONS
// ====================================

interface Material {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  chapter: {
    id: string;
    title: string;
  };
}

// ====================================
// COMPONENT
// ====================================

export default function LearnMaterialPage() {
  const params = useParams();
  const router = useRouter();
  const materialId = params.materialId as string;

  // Zustand store
  const currentEmotion = useCurrentEmotion();
  const user = useUser();

  // Local state
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adaptiveConfig, setAdaptiveConfig] = useState<FuzzyOutputs | null>(null);
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);

  // Easy-Read mode stabilization to avoid flicker.
  const EASY_READ_DEBOUNCE_ON_MS = 4000;
  const EASY_READ_DEBOUNCE_OFF_MS = 6000;
  const EASY_READ_MIN_HOLD_MS = 60000;

  const [easyReadPreference, setEasyReadPreference] = useState<'auto' | 'on' | 'off'>('auto');
  const [easyReadEnabled, setEasyReadEnabled] = useState(false);
  const [easyReadAutoReason, setEasyReadAutoReason] = useState<string | null>(null);

  const lastAutoEnabledAtRef = useRef<number>(0);
  const lastEncouragementAtRef = useRef<number>(0);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deactivationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ====================================
  // DATA FETCHING
  // ====================================

  useEffect(() => {
    async function fetchMaterial() {
      try {
        const response = await fetch(`/api/student/material/${materialId}`);
        if (!response.ok) throw new Error('Failed to fetch material');
        const data = await response.json();
        setMaterial(data);
      } catch (error) {
        console.error('Error fetching material:', error);
        toast.error('Failed to load material');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMaterial();
  }, [materialId]);

  // ====================================
  // ADAPTIVE UI LOGIC (FUZZY LOGIC)
  // ====================================

  useEffect(() => {
    if (!currentEmotion) {
      // Default config when no emotion detected
      setAdaptiveConfig({
        uiTheme: 'DEFAULT',
        showHint: false,
        simplifyText: false,
        showEncouragement: false,
        difficultyAdjustment: 'SAME',
        backgroundColor: 'bg-white',
        textColor: 'text-gray-900',
        showBreathingExercise: false,
      });
      return;
    }

    // Apply fuzzy logic to get adaptive configuration
    const config = applyFuzzyLogic({
      emotion: currentEmotion.label,
      confidence: currentEmotion.confidence,
      quizScore: 50, // Default, will be updated after quiz
    });

    // Stabilize "Easy-Read" and related assists so UI doesn't flip-flop.
    const shouldSuggestEasyRead = config.simplifyText || config.showHint;

    // Manual overrides
    if (easyReadPreference === 'on') {
      if (!easyReadEnabled) {
        setEasyReadEnabled(true);
      }
    } else if (easyReadPreference === 'off') {
      if (easyReadEnabled) {
        setEasyReadEnabled(false);
      }
    } else {
      // Auto mode with debounce + minimum hold
      const now = Date.now();

      if (shouldSuggestEasyRead) {
        if (deactivationTimerRef.current) {
          clearTimeout(deactivationTimerRef.current);
          deactivationTimerRef.current = null;
        }

        if (!easyReadEnabled && !activationTimerRef.current) {
          activationTimerRef.current = setTimeout(() => {
            activationTimerRef.current = null;
            setEasyReadEnabled(true);
            setEasyReadAutoReason(currentEmotion.label);
            lastAutoEnabledAtRef.current = Date.now();
            toast.info('Easy-Read Mode diaktifkan', {
              description: 'Kami mengaktifkan tampilan mudah-baca karena kamu terlihat kebingungan/tertekan.',
              duration: 4000,
            });
          }, EASY_READ_DEBOUNCE_ON_MS);
        }
      } else {
        if (activationTimerRef.current) {
          clearTimeout(activationTimerRef.current);
          activationTimerRef.current = null;
        }

        if (easyReadEnabled && !deactivationTimerRef.current) {
          const heldFor = now - (lastAutoEnabledAtRef.current || now);
          const remainingHold = Math.max(0, EASY_READ_MIN_HOLD_MS - heldFor);
          deactivationTimerRef.current = setTimeout(() => {
            deactivationTimerRef.current = null;
            setEasyReadEnabled(false);
            setEasyReadAutoReason(null);
          }, remainingHold + EASY_READ_DEBOUNCE_OFF_MS);
        }
      }
    }

    setAdaptiveConfig({
      ...config,
      // Keep assist UI consistent while Easy-Read is held on.
      simplifyText: easyReadEnabled,
      showHint: easyReadEnabled ? true : config.showHint,
    });

    // Show breathing exercise prompt if anxious
    if (config.showBreathingExercise && !showBreathingExercise) {
      setShowBreathingExercise(true);
      toast.info('💙 Take a moment to breathe deeply', {
        duration: 5000,
        description: 'You\'re doing great! Let\'s pause and take 3 deep breaths together.',
      });
    }

    // Show encouragement message
    if (config.showEncouragement) {
      const now = Date.now();
      // Rate-limit encouragement to avoid spamming.
      if (now - lastEncouragementAtRef.current > 30000) {
        lastEncouragementAtRef.current = now;
        const message = getEncouragementMessage(currentEmotion.label);
        toast(message, {
          duration: 4000,
          icon: '💪',
        });
      }
    }

    return () => {
      // Clean timers when emotion changes/unmounts
      if (activationTimerRef.current) {
        clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
      if (deactivationTimerRef.current) {
        clearTimeout(deactivationTimerRef.current);
        deactivationTimerRef.current = null;
      }
    };
  }, [
    currentEmotion,
    showBreathingExercise,
    easyReadEnabled,
    easyReadPreference,
  ]);

  // ====================================
  // HANDLERS
  // ====================================

  const handleNextMaterial = () => {
    // Logic to fetch next material
    toast.success('Moving to next material!');
    router.push('/student/dashboard');
  };

  const handleTakeQuiz = () => {
    router.push(`/student/quiz/${materialId}`);
  };

  // ====================================
  // RENDER - LOADING
  // ====================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading material...</p>
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Material not found</p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="mt-4 text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ====================================
  // RENDER - MAIN CONTENT
  // ====================================

  const bgColor = adaptiveConfig?.backgroundColor || 'bg-white';
  const textColor = adaptiveConfig?.textColor || 'text-gray-900';

  return (
    <div className={`min-h-screen ${bgColor} transition-colors duration-500`}>
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/student/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>

            {/* Emotion Indicator */}
            {currentEmotion && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">
                  {currentEmotion.label}
                </span>
                <span className="text-xs text-gray-500">
                  ({Math.round(currentEmotion.confidence * 100)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN - Material Content (Adaptive) */}
          <div className="lg:col-span-2">
            {/* Chapter Context */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">
                {material.chapter.title}
              </span>
            </div>

            {/* Title */}
            <h1 className={`text-4xl font-bold mb-6 ${textColor}`}>
              {material.title}
            </h1>

            {/* Difficulty Badge */}
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  material.difficulty === 'EASY'
                    ? 'bg-green-100 text-green-700'
                    : material.difficulty === 'MEDIUM'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {material.difficulty}
              </span>
            </div>

            {/* Image (if exists) */}
            {material.imageUrl && (
              <div className="mb-6 rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={material.imageUrl}
                  alt={material.title}
                  width={1200}
                  height={675}
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Adaptive Content */}
            <div className="bg-white rounded-lg shadow-sm p-8 border">
              {/* Easy-Read Status Banner */}
              {(easyReadEnabled || easyReadPreference !== 'auto') && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start justify-between gap-3">
                  <div className="text-sm text-blue-900">
                    <div className="font-semibold">Easy-Read Mode</div>
                    <div className="mt-1 text-blue-800">
                      {easyReadEnabled
                        ? `Aktif${easyReadPreference === 'on' ? ' (manual)' : easyReadAutoReason ? ` (otomatis: ${easyReadAutoReason})` : ' (otomatis)'}.`
                        : 'Nonaktif (manual).'}
                    </div>
                    {easyReadEnabled && easyReadPreference === 'auto' && (
                      <div className="mt-1 text-xs text-blue-700">
                        Mode ini dibuat stabil agar tidak berubah-ubah setiap detik.
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {easyReadEnabled ? (
                      <button
                        onClick={() => setEasyReadPreference('off')}
                        className="px-3 py-2 bg-white border border-blue-200 rounded-md text-sm text-blue-900 hover:bg-blue-100 transition-colors"
                      >
                        Kembalikan
                      </button>
                    ) : (
                      <button
                        onClick={() => setEasyReadPreference('auto')}
                        className="px-3 py-2 bg-white border border-blue-200 rounded-md text-sm text-blue-900 hover:bg-blue-100 transition-colors"
                      >
                        Kembali ke Auto
                      </button>
                    )}
                  </div>
                </div>
              )}

              <AdaptiveText
                content={material.content}
                isSimplified={adaptiveConfig?.simplifyText || false}
                className={textColor}
              />
            </div>

            {/* Hint Section (shown if fuzzy logic decides) */}
            {adaptiveConfig?.showHint && (
              <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">
                      💡 Helpful Hint
                    </h3>
                    <p className="text-blue-800">
                      Take your time with this material. If something is unclear, try
                      reading it again slowly. You can also take the quiz to test your
                      understanding step by step.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4">
              <button
                onClick={handleTakeQuiz}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Take Quiz
              </button>

              <button
                onClick={handleNextMaterial}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                Next Material
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - Camera & Stats */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Camera Card */}
              <div className="bg-white rounded-lg shadow-sm p-6 border">
                <h3 className="font-semibold mb-4">Emotion Detection</h3>
                {user && (
                  <EmotionCamera
                    userId={user.id}
                    materialId={materialId}
                    showVideo={true}
                    autoLog={true}
                    autoStart={true}
                  />
                )}
                <div className="mt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Detected class</span>
                    <span className="font-medium text-gray-900">
                      {currentEmotion ? currentEmotion.label : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-600">Confidence</span>
                    <span className="font-medium text-gray-900">
                      {currentEmotion ? `${Math.round(currentEmotion.confidence * 100)}%` : '—'}
                    </span>
                  </div>
                  {!currentEmotion && (
                    <p className="mt-2 text-xs text-gray-500">
                      Start camera untuk mulai deteksi. Jika tidak terdeteksi, pastikan wajah terlihat jelas.
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  We use your emotion to adapt the learning experience. Your privacy is
                  protected.
                </p>
              </div>

              {/* Emotion Stats */}
              {currentEmotion && (
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                  <h3 className="font-semibold mb-4">Current State</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Emotion</span>
                        <span className="font-medium">{currentEmotion.label}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${currentEmotion.confidence * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-600 mb-1">UI Theme</div>
                      <div className="font-medium">{adaptiveConfig?.uiTheme}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Breathing Exercise Card */}
              {showBreathingExercise && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">
                    🫁 Breathing Exercise
                  </h3>
                  <p className="text-sm text-blue-800 mb-4">
                    Let&apos;s take a moment to relax. Follow this breathing pattern:
                  </p>
                  <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                    <li>Breathe in slowly for 4 seconds</li>
                    <li>Hold for 4 seconds</li>
                    <li>Breathe out slowly for 4 seconds</li>
                    <li>Repeat 3 times</li>
                  </ol>
                  <button
                    onClick={() => setShowBreathingExercise(false)}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800"
                  >
                    I feel better now ✓
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
