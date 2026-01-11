/**
 * Fuzzy Logic System for Adaptive UI
 * 
 * This is the "Expert System" component that uses fuzzy logic rules
 * to determine UI adaptations based on student's emotional state and performance.
 * 
 * INPUT VARIABLES (Fuzzification):
 * 1. Emotion State (Negative, Neutral, Positive)
 * 2. Quiz Performance (Score: 0-100)
 * 3. Confidence Level (0.0 - 1.0)
 * 
 * OUTPUT VARIABLES (Defuzzification):
 * 1. UI Theme (CALM, DEFAULT, ENERGETIC)
 * 2. Show Hint (boolean)
 * 3. Simplify Text (boolean)
 * 4. Show Encouragement (boolean)
 * 5. Difficulty Adjustment (EASIER, SAME, HARDER)
 * 
 * FUZZY RULES:
 * - IF student is Negative AND confidence is HIGH THEN use CALM theme, show hints, simplify text
 * - IF student is Neutral AND score is LOW THEN show hints, simplify text, make easier
 * - IF student is Positive AND score is HIGH THEN use ENERGETIC theme, make harder
 * - etc.
 */

import type { EmotionLabel } from '@/lib/store';

// ====================================
// TYPE DEFINITIONS
// ====================================

export type UITheme = 'CALM' | 'DEFAULT' | 'ENERGETIC';
export type DifficultyAdjustment = 'EASIER' | 'SAME' | 'HARDER';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuizDifficultyInputs {
  durationSeconds: number; // time to answer the last question
  wrongCount: number; // cumulative wrong answers so far
}

export interface FuzzyInputs {
  emotion: EmotionLabel;
  confidence: number; // 0.0 - 1.0
  quizScore?: number; // 0-100 (optional, may not have quiz data yet)
  recentPerformance?: number[]; // Array of recent quiz scores for trend analysis
}

export interface FuzzyOutputs {
  uiTheme: UITheme;
  showHint: boolean;
  simplifyText: boolean;
  showEncouragement: boolean;
  difficultyAdjustment: DifficultyAdjustment;
  backgroundColor: string; // Tailwind color class
  textColor: string; // Tailwind color class
  showBreathingExercise: boolean; // For high anxiety
}

// ====================================
// FUZZY MEMBERSHIP FUNCTIONS
// ====================================

/**
 * Fuzzify confidence level
 * LOW: 0.0 - 0.5
 * MEDIUM: 0.4 - 0.7
 * HIGH: 0.6 - 1.0
 */
function fuzzifyConfidence(confidence: number): {
  low: number;
  medium: number;
  high: number;
} {
  return {
    low: confidence <= 0.5 ? 1 - confidence / 0.5 : 0,
    medium:
      confidence >= 0.4 && confidence <= 0.7
        ? confidence <= 0.55
          ? (confidence - 0.4) / 0.15
          : (0.7 - confidence) / 0.15
        : 0,
    high: confidence >= 0.6 ? (confidence - 0.6) / 0.4 : 0,
  };
}

/**
 * Fuzzify quiz score
 * LOW: 0 - 50
 * MEDIUM: 40 - 70
 * HIGH: 60 - 100
 */
function fuzzifyScore(score: number): {
  low: number;
  medium: number;
  high: number;
} {
  return {
    low: score <= 50 ? 1 - score / 50 : 0,
    medium:
      score >= 40 && score <= 70
        ? score <= 55
          ? (score - 40) / 15
          : (70 - score) / 15
        : 0,
    high: score >= 60 ? (score - 60) / 40 : 0,
  };
}

/**
 * Get emotion intensity score (for fuzzy operations)
 */
function getEmotionIntensity(emotion: EmotionLabel): number {
  const intensityMap: Record<EmotionLabel, number> = {
    Negative: 0.9,
    Neutral: 0,
    Positive: 0.8,
  };
  return intensityMap[emotion] || 0;
}

// ====================================
// FUZZY RULE ENGINE
// ====================================

/**
 * Apply fuzzy logic rules and return adaptive UI configuration
 */
export function applyFuzzyLogic(inputs: FuzzyInputs): FuzzyOutputs {
  const { emotion, confidence, quizScore = 50 } = inputs;

  // Fuzzify inputs
  const confLevel = fuzzifyConfidence(confidence);
  const scoreLevel = fuzzifyScore(quizScore);
  void getEmotionIntensity(emotion);

  // Initialize output with defaults
  let outputs: FuzzyOutputs = {
    uiTheme: 'DEFAULT',
    showHint: false,
    simplifyText: false,
    showEncouragement: false,
    difficultyAdjustment: 'SAME',
    backgroundColor: 'bg-white',
    textColor: 'text-gray-900',
    showBreathingExercise: false,
  };

  // ====================================
  // RULE 1: Negative Student
  // ====================================
  // NOTE:
  // MediaPipe fallback confidence is often lower than the TFJS model.
  // If we gate assist features behind a very high confidence threshold,
  // Easy-Read/hints will almost never activate under fallback.
  //
  // So: for "Negative" we enable core assists, and reserve the more
  // disruptive intervention (breathing exercise) for strong negatives.
  if (emotion === 'Negative') {
    outputs = {
      ...outputs,
      uiTheme: 'CALM',
      showHint: true,
      simplifyText: true,
      showEncouragement: true,
      difficultyAdjustment: scoreLevel.low > 0.5 ? 'EASIER' : 'SAME',
      backgroundColor: 'bg-blue-50',
      textColor: 'text-blue-900',
      // Strong negative only (roughly confidence >= 0.75)
      showBreathingExercise: confidence >= 0.75,
    };
  }

  // ====================================
  // RULE 2: Positive & High Performance
  // ====================================
  else if (emotion === 'Positive' && scoreLevel.high > 0.5) {
    outputs = {
      ...outputs,
      uiTheme: 'ENERGETIC',
      showHint: false,
      simplifyText: false,
      showEncouragement: true,
      difficultyAdjustment: 'HARDER',
      backgroundColor: 'bg-green-50',
      textColor: 'text-green-900',
      showBreathingExercise: false,
    };
  }

  // ====================================
  // RULE 3: Positive but Low Performance
  // ====================================
  else if (emotion === 'Positive' && scoreLevel.low > 0.5) {
    outputs = {
      ...outputs,
      uiTheme: 'DEFAULT',
      showHint: true,
      simplifyText: false,
      showEncouragement: true,
      difficultyAdjustment: 'SAME',
      backgroundColor: 'bg-yellow-50',
      textColor: 'text-yellow-900',
      showBreathingExercise: false,
    };
  }
  // ====================================
  // RULE 4: Neutral - Base on Performance
  // ====================================
  else if (emotion === 'Neutral') {
    if (scoreLevel.low > 0.5) {
      outputs.showHint = true;
      outputs.difficultyAdjustment = 'EASIER';
    } else if (scoreLevel.high > 0.5) {
      outputs.difficultyAdjustment = 'HARDER';
    }
  }

  return outputs;
}

// ====================================
// QUIZ DIFFICULTY (FUZZY)
// ====================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fuzzify answer duration (seconds)
 * FAST: 0-20
 * MEDIUM: 15-60
 * SLOW: 45+
 */
function fuzzifyDurationSeconds(durationSeconds: number): {
  fast: number;
  medium: number;
  slow: number;
} {
  const t = clamp(durationSeconds, 0, 300);

  // Triangular-ish membership
  const fast = t <= 20 ? 1 - t / 20 : 0;
  const medium =
    t >= 15 && t <= 60
      ? t <= 35
        ? (t - 15) / 20
        : (60 - t) / 25
      : 0;
  const slow = t >= 45 ? clamp((t - 45) / 60, 0, 1) : 0;

  return { fast, medium, slow };
}

/**
 * Fuzzify wrong count (cumulative)
 * LOW: 0-1
 * MEDIUM: 1-3
 * HIGH: 3+
 */
function fuzzifyWrongCount(wrongCount: number): {
  low: number;
  medium: number;
  high: number;
} {
  const w = clamp(wrongCount, 0, 10);
  const low = w <= 1 ? 1 - w / 1 : 0;
  const medium =
    w >= 1 && w <= 3
      ? w <= 2
        ? (w - 1) / 1
        : (3 - w) / 1
      : 0;
  const high = w >= 3 ? clamp((w - 3) / 2, 0, 1) : 0;
  return { low, medium, high };
}

/**
 * Decide next quiz difficulty using simple fuzzy rules.
 * Rules:
 * - IF slow OR wrong high => EASY
 * - IF fast AND wrong low => HARD
 * - ELSE => MEDIUM
 */
export function decideNextQuizDifficulty(inputs: QuizDifficultyInputs): QuizDifficulty {
  const duration = fuzzifyDurationSeconds(inputs.durationSeconds);
  const wrong = fuzzifyWrongCount(inputs.wrongCount);

  const easyStrength = Math.max(duration.slow, wrong.high);
  const hardStrength = Math.min(duration.fast, wrong.low);
  const mediumStrength = Math.max(duration.medium, wrong.medium);

  if (easyStrength >= hardStrength && easyStrength >= mediumStrength) return 'EASY';
  if (hardStrength >= easyStrength && hardStrength >= mediumStrength) return 'HARD';
  return 'MEDIUM';
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Get encouragement message based on emotion and performance
 */
export function getEncouragementMessage(
  emotion: EmotionLabel,
  score?: number
): string {
  if (emotion === 'Negative') {
    return "🫂 Tarik napas dulu. Kamu hebat—pelan-pelan aja, ya.";
  }
  if (emotion === 'Positive' && score && score > 70) {
    return '🎉 Keren! Kamu sudah paham. Yuk coba tantangan sedikit lebih sulit!';
  }
  if (emotion === 'Positive') {
    return '😊 Semangat bagus! Lanjutkan ya.';
  }
  return '👍 Kamu di jalur yang benar. Teruskan!';
}

/**
 * Calculate average performance from recent scores
 */
export function calculateAveragePerformance(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * Detect if student is in "anxiety pattern" (consistently anxious)
 */
export function detectAnxietyPattern(
  recentEmotions: Array<string | EmotionLabel>
): boolean {
  if (recentEmotions.length < 3) return false;

  const normalizeToCanonical = (label: string): EmotionLabel => {
    const normalized = label.trim().toLowerCase();

    if (normalized === 'positive' || normalized === 'happy') return 'Positive';
    if (normalized === 'neutral') return 'Neutral';
    if (normalized === 'negative') return 'Negative';

    if (
      normalized === 'anxious' ||
      normalized === 'confused' ||
      normalized === 'frustrated' ||
      normalized === 'sad' ||
      normalized === 'angry' ||
      normalized === 'fearful' ||
      normalized === 'disgusted'
    ) {
      return 'Negative';
    }

    if (normalized === 'surprised') return 'Neutral';

    return 'Neutral';
  };

  const negativeCount = recentEmotions
    .map((e) => normalizeToCanonical(String(e)))
    .filter((e) => e === 'Negative').length;

  // If more than 60% of recent emotions are negative
  return negativeCount / recentEmotions.length > 0.6;
}
