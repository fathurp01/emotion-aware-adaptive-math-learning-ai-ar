/**
 * Home Page - Landing & Login
 * 
 * Entry point for the application.
 * Provides login options for both students and teachers.
 */

import Link from 'next/link';
import { BookOpen, Brain, Heart, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">
              EmotionLearn
            </span>
          </div>
          <nav className="flex gap-4">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <Heart className="w-4 h-4" />
            Emotion-Aware Adaptive Learning
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Learn Mathematics with
            <span className="text-blue-600"> AI & Emotion Detection</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Our platform adapts to your emotions in real-time, creating a
            personalized learning experience that reduces anxiety and improves
            understanding.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/auth/register?role=student"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 group"
            >
              I&apos;m a Student
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/auth/register?role=teacher"
              className="px-8 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium flex items-center justify-center gap-2 group"
            >
              I&apos;m a Teacher
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <FeatureCard
              icon={<Brain className="w-8 h-8 text-blue-600" />}
              title="AI-Powered Quizzes"
              description="Questions adapt to your emotion and learning style using Gemini (with Mistral fallback)"
            />
            <FeatureCard
              icon={<Heart className="w-8 h-8 text-red-500" />}
              title="Emotion Detection"
              description="Real-time emotion recognition using TensorFlow.js and your webcam"
            />
            <FeatureCard
              icon={<BookOpen className="w-8 h-8 text-green-600" />}
              title="Adaptive Content"
              description="UI and content automatically adjust based on your emotional state"
            />
          </div>

          {/* How It Works */}
          <div className="mt-20 bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              How It Works
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <Step number="1" title="Take Quiz" description="Determine your learning style" />
              <Step number="2" title="Start Camera" description="Enable emotion detection" />
              <Step number="3" title="Learn & Adapt" description="UI changes based on emotion" />
              <Step number="4" title="Take AI Quiz" description="Get personalized questions" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <StatCard number="7" label="Emotions Detected" />
            <StatCard number="3" label="Learning Styles" />
            <StatCard number="100%" label="Adaptive" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="text-center text-gray-600">
          <p>Final Year Thesis Project - Emotion-Aware Adaptive Learning System</p>
          <p className="text-sm mt-2">Built with Next.js, TensorFlow.js, and Gemini/Mistral AI</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
        {number}
      </div>
      <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-8 text-white">
      <div className="text-4xl font-bold mb-2">{number}</div>
      <div className="text-blue-100">{label}</div>
    </div>
  );
}
