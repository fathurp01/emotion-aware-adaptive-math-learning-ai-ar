/**
 * Student Onboarding Page
 * 
 * 12-question VARK questionnaire to determine learning style
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEmotionStore, useUser } from '@/lib/store';
import { learningStyleQuestionnaire } from '@/utils/learningStyleAlgo';
import type { QuestionnaireAnswers, LearningStyle } from '@/utils/learningStyleAlgo';
import { Brain, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const user = useUser();
  const setUser = useEmotionStore((state) => state.setUser);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalQuestions = learningStyleQuestionnaire.length;
  const progress = (Object.keys(answers).length / totalQuestions) * 100;

  const handleAnswer = (questionId: number, style: LearningStyle) => {
    setAnswers({ ...answers, [questionId]: style });
    
    // Auto-advance to next question
    if (currentQuestion < totalQuestions - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < totalQuestions) {
      toast.error('Mohon jawab semua pertanyaan');
      return;
    }

    if (!user) {
      toast.error('User not found. Please login again');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/student/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          answers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save learning style');
      }

      const learningStyle: LearningStyle | undefined = data?.data?.learningStyle;
      const updatedUser = data?.data?.user;

      if (!learningStyle || !updatedUser) {
        throw new Error('Unexpected response from server');
      }

      // Update local session so other pages (quiz, dashboard) instantly see the learning style
      setUser(updatedUser);

      toast.success(`Gaya belajar Anda: ${learningStyle}`);
      router.push('/student/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error('Gagal menyimpan hasil kuesioner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = learningStyleQuestionnaire[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="container mx-auto max-w-3xl py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Kuesioner Gaya Belajar
          </h1>
          <p className="text-gray-600">
            Jawab 12 pertanyaan untuk mengetahui gaya belajar Anda
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Pertanyaan {currentQuestion + 1} dari {totalQuestions}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
              Pertanyaan {currentQuestion + 1}
            </span>
            <h2 className="text-xl font-semibold text-gray-900">
              {currentQ.question}
            </h2>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((option) => {
              const isSelected = answers[currentQ.id] === option.style;
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(currentQ.id, option.style)}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <div className={`font-medium mb-1 ${
                        isSelected ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {option.style}
                      </div>
                      <div className={`text-sm ${
                        isSelected ? 'text-blue-700' : 'text-gray-600'
                      }`}>
                        {option.text}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
          >
            Sebelumnya
          </button>

          {currentQuestion === totalQuestions - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length < totalQuestions}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Selesai'
              )}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(Math.min(totalQuestions - 1, currentQuestion + 1))}
              disabled={!answers[currentQ.id]}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              Selanjutnya
            </button>
          )}
        </div>

        {/* Answered Questions Indicator */}
        <div className="mt-8 flex justify-center gap-2 flex-wrap">
          {learningStyleQuestionnaire.map((q) => (
            <div
              key={q.id}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                answers[q.id]
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {q.id}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
