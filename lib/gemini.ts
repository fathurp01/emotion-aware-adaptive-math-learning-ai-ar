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
import { isMistralConfigured, mistralGenerateText } from './mistral';

const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();

// Initialize Gemini AI (only if configured)
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

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

const model = genAI
  ? genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens,
        temperature,
        topP: 0.8,
      },
    })
  : null;

type CacheEntry<T> = { value: T; expiresAt: number };
const memoryCache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

let geminiCooldownUntil = 0;

let geminiLock: Promise<void> = Promise.resolve();
async function withGeminiLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = geminiLock;
  let release!: () => void;
  geminiLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactText(input: string, maxChars: number): string {
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, maxChars));
}

function getCache<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function isGeminiCoolingDown(): boolean {
  return Date.now() < geminiCooldownUntil;
}

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
  return cleaned;
}

function normalizeQuizQuestion(input: any): QuizQuestion {
  const question = typeof input?.question === 'string' ? input.question : String(input?.question ?? '');
  const expectedAnswer =
    typeof input?.expectedAnswer === 'string'
      ? input.expectedAnswer
      : String(input?.expectedAnswer ?? '');

  const rawDifficulty = String(input?.difficulty ?? 'MEDIUM').toUpperCase();
  const difficulty =
    rawDifficulty === 'EASY' || rawDifficulty === 'HARD' || rawDifficulty === 'MEDIUM'
      ? (rawDifficulty as 'EASY' | 'MEDIUM' | 'HARD')
      : 'MEDIUM';

  const hint = typeof input?.hint === 'string' ? input.hint : undefined;
  const supportiveMessage =
    typeof input?.supportiveMessage === 'string' ? input.supportiveMessage : undefined;

  return { question, expectedAnswer, difficulty, hint, supportiveMessage };
}

function isGeminiQuotaOrRateLimitError(err: any): boolean {
  const status = err?.status;
  const message = String(err?.message || '');
  return (
    status === 429 ||
    /\b429\b|quota exceeded|exceeded your current quota|rate limit/i.test(message)
  );
}

async function generateContentWithRetry(prompt: string): Promise<string> {
  if (!model) {
    throw new Error('Gemini is not configured (missing GEMINI_API_KEY).');
  }
  // Minimal retry for rate limits (429). Keep small to avoid hammering.
  const maxAttempts = 2;
  let lastErr: unknown = null;

  // Avoid very long server hangs when API returns large retryDelay (e.g. 35s).
  // We'll still enter cooldown, but we fail fast so the caller can fall back.
  const maxSleepMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      const retryDelay =
        typeof err?.errorDetails?.find === 'function'
          ? err.errorDetails.find((d: any) => d?.retryDelay)?.retryDelay
          : null;

      if (status === 429 && attempt < maxAttempts - 1) {
        // If API gives retryDelay like "4s", honor it.
        const msFromRetry =
          typeof retryDelay === 'string' && retryDelay.endsWith('s')
            ? Number.parseFloat(retryDelay) * 1000
            : NaN;
        const suggestedWaitMs = Number.isFinite(msFromRetry) ? msFromRetry : 1500;

        // Enter cooldown to prevent a burst of parallel calls from hammering Gemini.
        geminiCooldownUntil = Math.max(
          geminiCooldownUntil,
          Date.now() + Math.max(1000, suggestedWaitMs)
        );

        // If the suggested retry is long, fail fast and let the caller fall back.
        if (suggestedWaitMs > maxSleepMs) {
          break;
        }

        const waitMs = Math.min(suggestedWaitMs, maxSleepMs);
        await sleep(waitMs);
        continue;
      }

      if (status === 429) {
        // Cool down longer if we are hard rate-limited.
        geminiCooldownUntil = Math.max(geminiCooldownUntil, Date.now() + 5000);
      }

      break;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Gemini generateContent failed');
}

async function generateTextWithFallback(prompt: string): Promise<string> {
  // Try Gemini first (if configured), unless we are already in cooldown.
  if (model && !isGeminiCoolingDown()) {
    try {
      return await generateContentWithRetry(prompt);
    } catch (err: any) {
      // If quota/rate-limited, try Mistral if configured.
      if (isGeminiQuotaOrRateLimitError(err) && isMistralConfigured()) {
        return await mistralGenerateText(prompt);
      }
      throw err;
    }
  }

  // If Gemini is cooling down or not configured, use Mistral if available.
  if (isMistralConfigured()) {
    return await mistralGenerateText(prompt);
  }

  // Nothing else configured.
  throw new Error('No AI provider available (Gemini unavailable and Mistral not configured).');
}

// ====================================
// EXPORTED GENERIC GENERATION
// ====================================

/**
 * Provider-agnostic text generation.
 * Uses Gemini when configured, otherwise falls back to Mistral if configured.
 */
export async function aiGenerateText(prompt: string): Promise<string> {
  return await generateTextWithFallback(prompt);
}

// ====================================
// TYPE DEFINITIONS
// ====================================

export type LearningStyle = 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';
export type EmotionType =
  | 'Negative'
  | 'Neutral'
  | 'Positive'
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
  hint?: string; // Only provided if student is struggling
  expectedAnswer: string; // For reference only
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  supportiveMessage?: string; // Encouraging message for struggling students
}

export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GenerateCalcQuestionOptions {
  questionIndex?: number;
  avoidQuestions?: string[];
}

export interface QuizFeedback {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string; // Detailed explanation
  encouragement: string; // Emotional support message
  nextSteps?: string; // What to study next
}

export type QuizQuestionType = 'RECAP' | 'CALC';

export interface GenerateFeedbackOptions {
  questionType?: QuizQuestionType;
  materialText?: string;
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
    const cacheKey = `quiz:${modelName}:${emotion}:${learningStyle}:${compactText(materialText, 200)}`;
    const cached = getCache<QuizQuestion>(cacheKey);
    if (cached) return cached;

    // If we're currently rate-limited and no other provider is configured, use fallback.
    if (isGeminiCoolingDown() && !isMistralConfigured()) {
      return {
        question: 'Explain the concept you just learned in your own words.',
        difficulty: 'MEDIUM',
        expectedAnswer: 'A clear explanation of the material content.',
        hint: emotion === 'Negative' || emotion === 'Anxious' ? 'Take your time and think about the main points.' : undefined,
      };
    }

    // Coalesce concurrent identical requests into a single Gemini call.
    const existing = inFlight.get(cacheKey);
    if (existing) return (await existing) as QuizQuestion;

    // Build emotion-aware context
    const emotionContext = getEmotionContext(emotion);
    
    // Build learning style context
    const styleContext = getLearningStyleContext(learningStyle);

    // Construct a compact prompt to reduce token usage
    const excerpt = compactText(materialText, 350);
    const prompt = [
      'You are a math tutor. Create 1 short question from the material.',
      `MATERIAL: ${excerpt}`,
      `EMOTION: ${emotion}.`,
      `STYLE: ${learningStyle}.`,
      `EMOTION_GUIDE: ${emotionContext}`,
      `STYLE_GUIDE: ${styleContext}`,
      'Return ONLY minified JSON (no markdown, no extra text) with keys:',
      'question, expectedAnswer, difficulty (EASY|MEDIUM|HARD), hint (optional), supportiveMessage (optional).',
      'Keep question and expectedAnswer very short (<= 25 words).',
      emotion === 'Negative' || emotion === 'Anxious'
        ? 'If EMOTION indicates struggle (Negative/Anxious): include hint + supportiveMessage.'
        : 'If not struggling: omit hint/supportiveMessage.',
    ].join('\n');

    const task = (async () => {
      const text = await withGeminiLock(() => generateTextWithFallback(prompt));

    // Parse JSON response
      const jsonText = extractJsonObject(text);
      const quizData = normalizeQuizQuestion(JSON.parse(jsonText));

      setCache(cacheKey, quizData, 5 * 60 * 1000);
      return quizData;
    })();

    inFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      inFlight.delete(cacheKey);
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    
    // Fallback question if API fails
    return {
      question: 'Explain the concept you just learned in your own words.',
      difficulty: 'MEDIUM',
      expectedAnswer: 'A clear explanation of the material content.',
      hint: emotion === 'Negative' || emotion === 'Anxious' ? 'Take your time and think about the main points.' : undefined,
    };
  }
}

/**
 * Generate a calculation-focused math question.
 * Designed to be token-efficient and return a strictly numeric expectedAnswer.
 */
export async function generateCalculationQuizQuestion(
  materialText: string,
  emotion: EmotionType,
  learningStyle: LearningStyle,
  targetDifficulty: QuizDifficulty,
  options?: GenerateCalcQuestionOptions
): Promise<QuizQuestion> {
  try {
    const avoid = (options?.avoidQuestions ?? [])
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 5);
    const idx = options?.questionIndex;

    const cacheKey = `quizcalc:${modelName}:${emotion}:${learningStyle}:${targetDifficulty}:${compactText(
      materialText,
      180
    )}:${idx ?? 'na'}:${compactText(avoid.join(' | '), 180)}`;
    const cached = getCache<QuizQuestion>(cacheKey);
    if (cached) return cached;

    if (isGeminiCoolingDown() && !isMistralConfigured()) {
      return {
        question: 'Hitung hasil: 12 + 8 = ?',
        expectedAnswer: '20',
        difficulty: 'EASY',
        hint: emotion === 'Negative' || emotion === 'Anxious' ? 'Kerjakan pelan-pelan ya.' : undefined,
        supportiveMessage: emotion === 'Negative' || emotion === 'Anxious' ? 'Kamu bisa.' : undefined,
      };
    }

    const existing = inFlight.get(cacheKey);
    if (existing) return (await existing) as QuizQuestion;

    const emotionContext = getEmotionContext(emotion);
    const styleContext = getLearningStyleContext(learningStyle);
    const excerpt = compactText(materialText, 260);
    const avoidLine = avoid.length ? `AVOID: ${avoid.map((q) => JSON.stringify(q)).join(',')}` : undefined;

    const prompt = [
      'Create 1 math CALCULATION question from the material.',
      `M:${excerpt}`,
      idx ? `IDX:${idx}` : undefined,
      avoidLine,
      `D:${targetDifficulty}`,
      `E:${emotion}`,
      `EG:${emotionContext}`,
      `S:${learningStyle}`,
      `SG:${styleContext}`,
      'Return ONLY minified JSON with keys: question, expectedAnswer, difficulty, hint(optional), supportiveMessage(optional).',
      'Rules: question must require computing a numeric final answer. expectedAnswer MUST be only the final number (no words, no units).',
      'The question MUST be different from any in AVOID. Vary numbers/coefficients so questions are not repeated.',
      'Keep question short (<= 25 words).',
      emotion === 'Negative' || emotion === 'Anxious'
        ? 'If E indicates struggle (Negative/Anxious) include hint + supportiveMessage.'
        : 'If not struggling omit hint/supportiveMessage.',
    ]
      .filter(Boolean)
      .join('\n');

    const task = (async () => {
      const text = await withGeminiLock(() => generateTextWithFallback(prompt));
      const jsonText = extractJsonObject(text);
      const data = normalizeQuizQuestion(JSON.parse(jsonText));
      setCache(cacheKey, data, 5 * 60 * 1000);
      return data;
    })();

    inFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      inFlight.delete(cacheKey);
    }
  } catch (error) {
    console.error('Error generating calculation quiz:', error);
    return {
      question: 'Hitung hasil: 15 × 3 = ?',
      expectedAnswer: '45',
      difficulty: 'EASY',
      hint: emotion === 'Negative' || emotion === 'Anxious' ? 'Ingat perkalian itu penjumlahan berulang.' : undefined,
      supportiveMessage: emotion === 'Negative' || emotion === 'Anxious' ? 'Tenang, kamu bisa.' : undefined,
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
  emotion: EmotionType,
  options?: GenerateFeedbackOptions
): Promise<QuizFeedback> {
  try {
    const questionType: QuizQuestionType = options?.questionType ?? 'CALC';
    const materialExcerpt = options?.materialText ? compactText(options.materialText, 380) : '';

    const cacheKey = `feedback:${modelName}:${emotion}:${compactText(question, 120)}:${compactText(userAnswer, 120)}:${compactText(expectedAnswer, 120)}`;
    const cached = getCache<QuizFeedback>(cacheKey);
    if (cached) return cached;

    const existing = inFlight.get(cacheKey);
    if (existing) return (await existing) as QuizFeedback;

    const emotionContext = getEmotionContext(emotion);

    const prompt = [
      'You are a math tutor. Grade the student answer and respond ONLY minified JSON.',
      `EMOTION: ${emotion}. GUIDE: ${emotionContext}`,
      `TYPE: ${questionType}.`,
      materialExcerpt ? `MATERIAL: ${materialExcerpt}` : undefined,
      `Q: ${compactText(question, 240)}`,
      `EXPECTED: ${compactText(expectedAnswer, 120)}`,
      `STUDENT: ${compactText(userAnswer, 120)}`,
      'Rubric:',
      '- For CALC: treat equivalent expressions as correct (e.g. "2+2" equals 4). Score 100 correct, 70 almost correct, 0 wrong/irrelevant.',
      '- For RECAP: score based on coverage of key points from MATERIAL. 100 good coverage, 70 partial, 40 minimal, 0 off-topic.',
      'JSON keys: isCorrect(boolean), score(number 0-100), feedback(string <=2 sentences), encouragement(string <=1 sentence).',
    ]
      .filter(Boolean)
      .join('\n');

    const task = (async () => {
      const text = await withGeminiLock(() => generateTextWithFallback(prompt));
      const jsonText = extractJsonObject(text);

      const feedbackData = JSON.parse(jsonText) as QuizFeedback;

      // Basic runtime hardening.
      feedbackData.isCorrect = Boolean((feedbackData as any).isCorrect);
      const rawScore = Number((feedbackData as any).score);
      feedbackData.score = Number.isFinite(rawScore) ? clampNumber(rawScore, 0, 100) : 0;
      feedbackData.feedback = typeof (feedbackData as any).feedback === 'string' ? (feedbackData as any).feedback : '';
      feedbackData.encouragement =
        typeof (feedbackData as any).encouragement === 'string' ? (feedbackData as any).encouragement : '';

      if (!feedbackData.feedback) {
        throw new Error('AI feedback JSON missing feedback');
      }

      setCache(cacheKey, feedbackData, 2 * 60 * 1000);
      return feedbackData;
    })();

    inFlight.set(cacheKey, task);
    try {
      return await task;
    } finally {
      inFlight.delete(cacheKey);
    }
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
    Negative: 'The student seems to be struggling. Be EXTRA supportive, provide hints, simplify language, and use encouraging tone.',
    Neutral: 'The student is calm and focused. Use standard difficulty.',
    Positive: 'The student is confident and engaged. You can challenge them slightly more.',
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
      'Simplify this math material for a student who is struggling (negative emotion).',
      'Use simple language, short sentences, focus on core concepts.',
      `Material: ${materialText.substring(0, 800)}`,
      'Return 3 short sentences.',
    ].join('\n');

    // Use provider chain (Gemini -> Mistral) and serialize calls.
    const text = await withGeminiLock(() => generateTextWithFallback(prompt));
    return text;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Take a deep breath. Let\'s break this down into smaller steps. You can do this!';
  }
}
