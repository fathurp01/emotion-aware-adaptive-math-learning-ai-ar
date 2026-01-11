/**
 * Student Quiz Page (Chat Interface)
 * 
 * Interactive chat-based quiz with real-time AI feedback
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCurrentEmotion, useHasHydrated, useUser } from '@/lib/store';
import { Send, Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface QuizQuestion {
  question: string;
  expectedAnswer: string;
  hint?: string;
  supportiveMessage?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  questionIndex?: number;
  questionType?: 'RECAP' | 'CALC';
  targetDifficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  struggleNudge?: string;
}

interface Message {
  id: string;
  type: 'bot' | 'user' | 'feedback';
  content: string;
  isCorrect?: boolean;
  score?: number;
  timestamp: Date;
}

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const user = useUser();
  const hasHydrated = useHasHydrated();
  const currentEmotion = useCurrentEmotion();
  const materialId = params.materialId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStartAt, setQuestionStartAt] = useState<number | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [material, setMaterial] = useState<any>(null);
  const [shownStruggleNudge, setShownStruggleNudge] = useState(false);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

  const TOTAL_QUESTIONS = 10;

  const fetchMaterial = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/material/${materialId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterial(data);
      }
    } catch (error) {
      console.error('Error fetching material:', error);
    }
  }, [materialId]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    fetchMaterial();
  }, [hasHydrated, user, router, fetchMaterial]);

  const startQuiz = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Reset session state
      setMessages([]);
      setCurrentQuestion(null);
      setIsFinished(false);
      setWrongCount(0);
      setTotalScore(0);
      setAnsweredCount(0);
      setQuestionIndex(1);
      setQuestionStartAt(null);
      setShownStruggleNudge(false);
      setPreviousQuestions([]);

      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          userId: user.id,
          questionIndex: 1,
          currentEmotion: currentEmotion?.label || 'Neutral',
          confidence: currentEmotion?.confidence ?? 1.0,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate quiz');

      const payload = await res.json();
      const question: QuizQuestion = payload?.data;
      setCurrentQuestion(question);
      setIsStarted(true);
      setQuestionStartAt(Date.now());
      if (question?.question) setPreviousQuestions([question.question]);

      const botMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: question.question,
        timestamp: new Date(),
      };

      if (question.supportiveMessage) {
        botMessage.content += `\n\n💡 ${question.supportiveMessage}`;
      }

      if (question.hint) {
        botMessage.content += `\n\n🎯 Hint: ${question.hint}`;
      }

      setMessages([botMessage]);
    } catch (error) {
      console.error('Error starting quiz:', error);
      toast.error('Gagal memulai quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion || !user || isFinished) return;

    const startedAt = questionStartAt ?? Date.now();
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userAnswer,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserAnswer('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/quiz/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          materialId,
          questionIndex: currentQuestion.questionIndex ?? questionIndex,
          questionType: currentQuestion.questionType,
          durationSeconds,
          question: currentQuestion.question,
          userAnswer: userAnswer,
          expectedAnswer: String(currentQuestion.expectedAnswer),
          currentEmotion: currentEmotion?.label || 'Neutral',
        }),
      });

      if (!res.ok) throw new Error('Failed to get feedback');

      const feedbackPayload = await res.json();
      const feedback = feedbackPayload?.data;

      const feedbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'feedback',
        content: feedback.feedback,
        isCorrect: feedback.isCorrect,
        score: feedback.score,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, feedbackMessage]);

      // Update session stats
      const isCorrect = Boolean(feedback.isCorrect);
      const scoreNum = typeof feedback.score === 'number' ? feedback.score : 0;
      setTotalScore((s) => s + scoreNum);
      setAnsweredCount((c) => c + 1);
      if (!isCorrect) setWrongCount((w) => w + 1);

      const nextIndex = (currentQuestion.questionIndex ?? questionIndex) + 1;
      const nextWrong = (isCorrect ? wrongCount : wrongCount + 1);
      const nextAnswered = answeredCount + 1;

      // Stop after TOTAL_QUESTIONS answered
      if (nextAnswered >= TOTAL_QUESTIONS) {
        setIsFinished(true);
        setIsLoading(false);
        setCurrentQuestion(null);
        return;
      }

      // Generate next question after 2 seconds
      setTimeout(async () => {
        try {
          const avoidList = [
            ...previousQuestions,
            currentQuestion?.question ? currentQuestion.question : '',
          ]
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(-6);

          const nextRes = await fetch('/api/quiz/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              materialId,
              userId: user.id,
              questionIndex: nextIndex,
              lastDurationSeconds: durationSeconds,
              wrongCount: nextWrong,
              previousQuestions: avoidList,
              currentEmotion: currentEmotion?.label || 'Neutral',
              confidence: currentEmotion?.confidence ?? 1.0,
            }),
          });

          if (nextRes.ok) {
            const nextPayload = await nextRes.json();
            const nextQuestion: QuizQuestion = nextPayload?.data;
            setCurrentQuestion(nextQuestion);
            setQuestionIndex(nextIndex);
            setQuestionStartAt(Date.now());
            if (nextQuestion?.question) {
              setPreviousQuestions((prev) => [...prev, nextQuestion.question].slice(-6));
            }

            if (!shownStruggleNudge && nextQuestion.struggleNudge) {
              setShownStruggleNudge(true);
              const nudgeMessage: Message = {
                id: `${Date.now()}-nudge`,
                type: 'bot',
                content: nextQuestion.struggleNudge,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, nudgeMessage]);
            }

            const nextBotMessage: Message = {
              id: Date.now().toString(),
              type: 'bot',
              content: nextQuestion.question,
              timestamp: new Date(),
            };

            if (nextQuestion.supportiveMessage) {
              nextBotMessage.content += `\n\n💡 ${nextQuestion.supportiveMessage}`;
            }

            if (nextQuestion.hint) {
              nextBotMessage.content += `\n\n🎯 Hint: ${nextQuestion.hint}`;
            }

            setMessages((prev) => [...prev, nextBotMessage]);
          }
        } catch (error) {
          console.error('Error generating next question:', error);
        } finally {
          setIsLoading(false);
        }
      }, 2000);
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Gagal mengirim jawaban');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && userAnswer.trim()) {
      submitAnswer();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Quiz Interaktif</h1>
                {material && (
                  <p className="text-sm text-gray-600">{material.title}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!isStarted ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Send className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Siap untuk memulai quiz?
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Kamu akan mendapatkan pertanyaan yang disesuaikan dengan gaya belajarmu.
              Jawab dengan teliti dan dapatkan feedback langsung dari AI!
            </p>
            <button
              onClick={startQuiz}
              disabled={isLoading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memuat...
                </>
              ) : (
                'Mulai Quiz'
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
              <div>
                Soal {Math.min(answeredCount + 1, TOTAL_QUESTIONS)}/{TOTAL_QUESTIONS}
              </div>
              <div>
                Skor sementara: {answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0}
              </div>
            </div>

            {/* Emotion guidance */}
            {currentEmotion?.label === 'Negative' && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
                <div className="font-semibold">Tenang dulu ya</div>
                <div className="text-sm text-blue-800">
                  Kamu terlihat sedikit tertekan. Tarik napas pelan 3 kali, lalu kerjakan pelan-pelan.
                  Kalau perlu, baca kembali materi sebentar.
                </div>
              </div>
            )}

            {currentEmotion?.label === 'Neutral' && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
                <div className="font-semibold">Kamu sudah cukup tenang</div>
                <div className="text-sm text-gray-700">
                  Lanjutkan dengan ritme normal ya. Fokus ke langkah-langkahnya, dan kalau mentok gunakan hint.
                </div>
              </div>
            )}

            {currentEmotion?.label === 'Positive' && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900">
                <div className="font-semibold">Mantap!</div>
                <div className="text-sm text-green-800">
                  Sepertinya kamu dengan gampang memahami materi{material?.title ? `: ${material.title}` : ''}. Coba selesaikan soal berikut.
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="bg-white rounded-lg shadow-sm border mb-4">
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : message.type === 'feedback'
                          ? message.isCorrect
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-orange-50 border border-orange-200'
                          : 'bg-gray-100'
                      }`}
                    >
                      {message.type === 'feedback' && (
                        <div className="flex items-center gap-2 mb-2">
                          {message.isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-orange-600" />
                          )}
                          <span
                            className={`font-semibold ${
                              message.isCorrect ? 'text-green-700' : 'text-orange-700'
                            }`}
                          >
                            Score: {message.score}/100
                          </span>
                        </div>
                      )}
                      <p
                        className={`whitespace-pre-wrap ${
                          message.type === 'feedback'
                            ? message.isCorrect
                              ? 'text-green-900'
                              : 'text-orange-900'
                            : message.type === 'user'
                            ? 'text-white'
                            : 'text-gray-900'
                        }`}
                      >
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-2 ${
                          message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && messages.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            {!isFinished ? (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ketik jawabanmu di sini..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={isLoading || !userAnswer.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-900">Quiz Selesai</h3>
                <p className="mt-1 text-gray-700">
                  Skor akhir: <span className="font-semibold">{answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0}</span>/100
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={startQuiz}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ambil Ulang Quiz
                  </button>
                  <Link
                    href={`/student/learn/${materialId}`}
                    className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Belajar Ulang
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
