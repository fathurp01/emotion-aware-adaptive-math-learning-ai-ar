/**
 * Fuzzy Logic System for Adaptive UI
 * 
 * This is the "Expert System" component that uses fuzzy logic rules
 * to determine UI adaptations based on student's emotional state and performance.
 * 
 * INPUT VARIABLES (Fuzzification):
 * 1. Emotion State (Neutral, Happy, Anxious, Confused, Frustrated)
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
 * - IF student is Anxious AND confidence is HIGH THEN use CALM theme, show hints, simplify text
 * - IF student is Confused AND score is LOW THEN show hints, simplify text, make easier
 * - IF student is Happy AND score is HIGH THEN use ENERGETIC theme, make harder
 * - etc.
 */

import type { EmotionLabel } from '@/lib/store';

// ====================================
// TYPE DEFINITIONS
// ====================================

export type UITheme = 'CALM' | 'DEFAULT' | 'ENERGETIC';
export type DifficultyAdjustment = 'EASIER' | 'SAME' | 'HARDER';

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
    Neutral: 0,
    Happy: 0.8,
    Anxious: 0.9,
    Confused: 0.7,
    Frustrated: 0.85,
    Sad: 0.75,
    Surprised: 0.6,
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
  const emotionIntensity = getEmotionIntensity(emotion);

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
  // RULE 1: Anxious Student
  // ====================================
  if (emotion === 'Anxious' && confLevel.high > 0.5) {
    outputs = {
      ...outputs,
      uiTheme: 'CALM',
      showHint: true,
      simplifyText: true,
      showEncouragement: true,
      difficultyAdjustment: scoreLevel.low > 0.5 ? 'EASIER' : 'SAME',
      backgroundColor: 'bg-blue-50',
      textColor: 'text-blue-900',
      showBreathingExercise: true,
    };
  }

  // ====================================
  // RULE 2: Confused Student
  // ====================================
  else if (emotion === 'Confused') {
    outputs = {
      ...outputs,
      uiTheme: 'CALM',
      showHint: true,
      simplifyText: true,
      showEncouragement: true,
      difficultyAdjustment: 'EASIER',
      backgroundColor: 'bg-purple-50',
      textColor: 'text-purple-900',
      showBreathingExercise: false,
    };
  }

  // ====================================
  // RULE 3: Frustrated Student
  // ====================================
  else if (emotion === 'Frustrated') {
    outputs = {
      ...outputs,
      uiTheme: 'CALM',
      showHint: true,
      simplifyText: scoreLevel.low > 0.5,
      showEncouragement: true,
      difficultyAdjustment: 'EASIER',
      backgroundColor: 'bg-orange-50',
      textColor: 'text-orange-900',
      showBreathingExercise: true,
    };
  }

  // ====================================
  // RULE 4: Happy & High Performance
  // ====================================
  else if (emotion === 'Happy' && scoreLevel.high > 0.5) {
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
  // RULE 5: Happy but Low Performance
  // ====================================
  else if (emotion === 'Happy' && scoreLevel.low > 0.5) {
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
  // RULE 6: Sad Student
  // ====================================
  else if (emotion === 'Sad') {
    outputs = {
      ...outputs,
      uiTheme: 'CALM',
      showHint: true,
      simplifyText: true,
      showEncouragement: true,
      difficultyAdjustment: 'EASIER',
      backgroundColor: 'bg-indigo-50',
      textColor: 'text-indigo-900',
      showBreathingExercise: true,
    };
  }

  // ====================================
  // RULE 7: Neutral - Base on Performance
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
// UTILITY FUNCTIONS
// ====================================

/**
 * Get encouragement message based on emotion and performance
 */
export function getEncouragementMessage(
  emotion: EmotionLabel,
  score?: number
): string {
  if (emotion === 'Anxious') {
    return '🫂 Take a deep breath. You\'re doing great! Remember, it\'s okay to take your time.';
  }
  if (emotion === 'Confused') {
    return '💡 Let\'s break this down together. Every question helps you understand better!';
  }
  if (emotion === 'Frustrated') {
    return '💪 I know this is challenging, but you\'re making progress. Take a short break if you need one.';
  }
  if (emotion === 'Sad') {
    return '🌟 Remember, learning is a journey. Every step counts, and you\'re doing wonderfully!';
  }
  if (emotion === 'Happy' && score && score > 70) {
    return '🎉 Amazing work! Your effort is really paying off. Keep up the excellent progress!';
  }
  if (emotion === 'Happy') {
    return '😊 Great attitude! Your positive energy makes learning easier!';
  }
  return '👍 You\'re on the right track. Keep going!';
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
  recentEmotions: EmotionLabel[]
): boolean {
  if (recentEmotions.length < 3) return false;
  
  const anxiousCount = recentEmotions.filter(
    (e) => e === 'Anxious' || e === 'Frustrated' || e === 'Sad'
  ).length;
  
  // If more than 60% of recent emotions are negative
  return anxiousCount / recentEmotions.length > 0.6;
}
