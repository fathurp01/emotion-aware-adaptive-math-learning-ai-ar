/**
 * Student Quiz Page (Chat Interface)
 * 
 * Interactive chat-based quiz with real-time AI feedback
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/lib/store';
import { Send, Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface QuizQuestion {
  question: string;
  expectedAnswer: string;
  hint?: string;
  supportiveMessage?: string;
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
  const materialId = params.materialId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [material, setMaterial] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    fetchMaterial();
  }, [user, materialId, router]);

  const fetchMaterial = async () => {
    try {
      const res = await fetch(`/api/student/material/${materialId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterial(data);
      }
    } catch (error) {
      console.error('Error fetching material:', error);
    }
  };

  const startQuiz = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          learningStyle: user.learningStyle,
          emotion: 'neutral',
        }),
      });

      if (!res.ok) throw new Error('Failed to generate quiz');

      const question: QuizQuestion = await res.json();
      setCurrentQuestion(question);
      setIsStarted(true);

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
    if (!userAnswer.trim() || !currentQuestion || !user) return;

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
          question: currentQuestion.question,
          userAnswer: userAnswer,
          expectedAnswer: currentQuestion.expectedAnswer,
          emotion: 'neutral',
        }),
      });

      if (!res.ok) throw new Error('Failed to get feedback');

      const feedback = await res.json();

      const feedbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'feedback',
        content: feedback.feedback,
        isCorrect: feedback.isCorrect,
        score: feedback.score,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, feedbackMessage]);

      // Log quiz to database
      await fetch('/api/student/quiz-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          materialId,
          userAnswer,
          aiFeedback: feedback.feedback,
          score: feedback.score,
          detectedEmotion: 'neutral',
        }),
      });

      // Generate next question after 2 seconds
      setTimeout(async () => {
        try {
          const nextRes = await fetch('/api/quiz/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              materialId,
              learningStyle: user.learningStyle,
              emotion: 'neutral',
            }),
          });

          if (nextRes.ok) {
            const nextQuestion: QuizQuestion = await nextRes.json();
            setCurrentQuestion(nextQuestion);

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
          </>
        )}
      </div>
    </div>
  );
}
