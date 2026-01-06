/**
 * Google Gemini AI Integration
 * 
 * This module handles all interactions with Google's Generative AI (Gemini 1.5 Flash).
 * It provides intelligent quiz generation and feedback based on:
 * - Student's current emotion
 * - Student's learning style
 * - Material content
 * 
 * Features:
 * - Adaptive quiz generation
 * - Emotion-aware prompting
 * - Learning style personalization
 * - Structured JSON responses
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Use Gemini model from environment (default: gemini-2.0-flash)
const modelName = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

// Quota-friendly defaults (override via env):
// - GEMINI_MAX_OUTPUT_TOKENS: cap output size
// - GEMINI_TEMPERATURE: keep responses concise/deterministic
const maxOutputTokens = clampNumber(parseEnvInt('GEMINI_MAX_OUTPUT_TOKENS', 256), 64, 1024);
const temperature = clampNumber(parseEnvFloat('GEMINI_TEMPERATURE', 0.2), 0, 1);

const model = genAI.getGenerativeModel({
  model: modelName,
  generationConfig: {
    maxOutputTokens,
    temperature,
    topP: 0.8,
  },
});

// ====================================
// TYPE DEFINITIONS
// ====================================

export type LearningStyle = 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';
export type EmotionType =
  | 'Neutral'
  | 'Happy'
  | 'Anxious'
  | 'Confused'
  | 'Frustrated'
  | 'Sad'
  | 'Angry'
  | 'Fearful'
  | 'Disgusted'
  | 'Surprised';

export interface QuizQuestion {
  question: string;
  hint?: string; // Only provided if student is anxious
  expectedAnswer: string; // For reference only
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  supportiveMessage?: string; // Encouraging message for anxious students
}

export interface QuizFeedback {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string; // Detailed explanation
  encouragement: string; // Emotional support message
  nextSteps?: string; // What to study next
}

// ====================================
// MAIN FUNCTIONS
// ====================================

/**
 * Generate a quiz question based on material content, emotion, and learning style
 * 
 * @param materialText - The learning material content
 * @param emotion - Current detected emotion
 * @param learningStyle - Student's preferred learning style
 * @returns Promise<QuizQuestion>
 */
export async function generateQuiz(
  materialText: string,
  emotion: EmotionType,
  learningStyle: LearningStyle
): Promise<QuizQuestion> {
  try {
    // Build emotion-aware context
    const emotionContext = getEmotionContext(emotion);
    
    // Build learning style context
    const styleContext = getLearningStyleContext(learningStyle);

    // Construct a compact prompt to reduce token usage
    const excerpt = materialText.substring(0, 600);
    const prompt = [
      'You are a mathematics teacher.',
      `Material excerpt: ${excerpt}`,
      `Student emotion: ${emotion}.`,
      `Learning style: ${learningStyle}.`,
      `Emotion guidance: ${emotionContext}`,
      `Style guidance: ${styleContext}`,
      'Task: create ONE math question based on the excerpt.',
      'Output ONLY JSON with keys:',
      'question, expectedAnswer, difficulty (EASY|MEDIUM|HARD), hint (optional), supportiveMessage (optional).',
      emotion === 'Anxious'
        ? 'For Anxious: make it easier, include hint + supportiveMessage.'
        : 'If not anxious: omit hint/supportiveMessage unless truly needed.',
    ].join('\n');

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const quizData = JSON.parse(cleanedText) as QuizQuestion;

    return quizData;
  } catch (error) {
    console.error('Error generating quiz:', error);
    
    // Fallback question if API fails
    return {
      question: 'Explain the concept you just learned in your own words.',
      difficulty: 'MEDIUM',
      expectedAnswer: 'A clear explanation of the material content.',
      hint: emotion === 'Anxious' ? 'Take your time and think about the main points.' : undefined,
    };
  }
}

/**
 * Generate feedback for a student's answer
 * 
 * @param question - The original question
 * @param userAnswer - Student's answer
 * @param expectedAnswer - The expected/correct answer
 * @param emotion - Current detected emotion
 * @returns Promise<QuizFeedback>
 */
export async function generateFeedback(
  question: string,
  userAnswer: string,
  expectedAnswer: string,
  emotion: EmotionType
): Promise<QuizFeedback> {
  try {
    const emotionContext = getEmotionContext(emotion);

    const prompt = [
      'You are a supportive mathematics teacher.',
      `Emotion: ${emotion}. Guidance: ${emotionContext}`,
      `Question: ${question}`,
      `Expected answer: ${expectedAnswer}`,
      `Student answer: ${userAnswer}`,
      'Task: judge correctness, give score 0-100, short explanation.',
      'Keep feedback concise (max 3 short sentences).',
      'Output ONLY JSON with keys: isCorrect, score, feedback, encouragement, nextSteps (optional).',
    ].join('\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const feedbackData = JSON.parse(cleanedText) as QuizFeedback;

    return feedbackData;
  } catch (error) {
    console.error('Error generating feedback:', error);
    
    // Fallback feedback
    return {
      isCorrect: false,
      score: 50,
      feedback: 'Thank you for your answer. Please review the material again.',
      encouragement: 'Keep practicing! You\'re making progress.',
    };
  }
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Get context description for current emotion
 */
function getEmotionContext(emotion: EmotionType): string {
  const contexts: Record<EmotionType, string> = {
    Neutral: 'The student is calm and focused. Use standard difficulty.',
    Happy: 'The student is confident and engaged. You can challenge them slightly more.',
    Anxious: 'The student is nervous or stressed. Be EXTRA supportive, provide hints, and use encouraging language. Simplify the question.',
    Confused: 'The student is struggling to understand. Break things down step-by-step and use clear, simple language.',
    Frustrated: 'The student is feeling overwhelmed. Offer reassurance and focus on small, achievable steps.',
    Sad: 'The student may be discouraged. Be gentle, encouraging, and highlight their strengths.',
    Surprised: 'The student is surprised. Keep the content engaging and interesting.',
    Angry: 'The student is upset or frustrated. Use calming language and be patient.',
    Fearful: 'The student is anxious or scared. Be very supportive and provide lots of encouragement.',
    Disgusted: 'The student is disengaged. Try to make the content more appealing and relevant.',
  };

  return contexts[emotion] || contexts.Neutral;
}

/**
 * Get context description for learning style
 */
function getLearningStyleContext(style: LearningStyle): string {
  const contexts: Record<LearningStyle, string> = {
    VISUAL: 'This student learns best through images, diagrams, and visual representations. When possible, reference visual elements or suggest drawing/sketching.',
    AUDITORY: 'This student learns best through verbal explanations and discussions. Use clear verbal descriptions and encourage them to explain concepts out loud.',
    KINESTHETIC: 'This student learns best through hands-on practice and real-world examples. Use practical scenarios and encourage active problem-solving.',
  };

  return contexts[style] || contexts.VISUAL;
}

/**
 * Generate a summary of material for easier understanding
 * Used when student is confused or anxious
 */
export async function generateSimplifiedSummary(
  materialText: string
): Promise<string> {
  try {
    const prompt = [
      'Simplify this math material for an anxious/confused student.',
      'Use simple language, short sentences, focus on core concepts.',
      `Material: ${materialText.substring(0, 800)}`,
      'Return 3 short sentences.',
    ].join('\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Take a deep breath. Let\'s break this down into smaller steps. You can do this!';
  }
}
