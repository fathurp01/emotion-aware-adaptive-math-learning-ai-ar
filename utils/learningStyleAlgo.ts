/**
 * Learning Style Assessment Algorithm
 * 
 * This module implements the VARK (Visual, Auditory, Read/Write, Kinesthetic) model
 * adapted for our system (VAK - Visual, Auditory, Kinesthetic).
 * 
 * Students complete a questionnaire, and this algorithm determines their dominant learning style.
 * 
 * Questionnaire Structure:
 * - 12 questions
 * - Each question has 3 options (Visual, Auditory, Kinesthetic)
 * - Scoring determines the dominant style
 */

// ====================================
// TYPE DEFINITIONS
// ====================================

export type LearningStyle = 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';

export interface QuestionOption {
  style: LearningStyle;
  text: string;
  value: string;
}

export interface Question {
  id: number;
  question: string;
  options: QuestionOption[];
}

export interface QuestionnaireAnswers {
  [questionId: number]: LearningStyle;
}

export interface StyleScores {
  VISUAL: number;
  AUDITORY: number;
  KINESTHETIC: number;
}

// ====================================
// QUESTIONNAIRE DEFINITION
// ====================================

export const learningStyleQuestionnaire: Question[] = [
  {
    id: 1,
    question: 'When learning a new math concept, I prefer to:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'See diagrams, charts, or visual representations',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Listen to explanations or discuss it with others',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Work through practice problems hands-on',
      },
    ],
  },
  {
    id: 2,
    question: 'When solving a math problem, I usually:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Draw pictures or diagrams to visualize the solution',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Talk through the steps out loud or in my head',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Use objects or write out multiple attempts',
      },
    ],
  },
  {
    id: 3,
    question: 'I remember math formulas best when:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'I see them written down with color coding',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'I repeat them to myself multiple times',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'I use them in practice problems repeatedly',
      },
    ],
  },
  {
    id: 4,
    question: 'When I study for a math test, I:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Review notes, diagrams, and highlighted materials',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Recite formulas and explain concepts aloud',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Do lots of practice problems and examples',
      },
    ],
  },
  {
    id: 5,
    question: 'In a math class, I learn best when the teacher:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Uses slides, videos, or writes on the board',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Explains verbally and encourages discussion',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Gives us hands-on activities and practical tasks',
      },
    ],
  },
  {
    id: 6,
    question: 'When I encounter a difficult math problem, I:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Look for similar examples with diagrams',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Ask someone to explain it to me',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Try different approaches until something works',
      },
    ],
  },
  {
    id: 7,
    question: 'My ideal study environment for math includes:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Good lighting and organized visual materials',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'A quiet place where I can read aloud or discuss',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Space to move around and work through problems actively',
      },
    ],
  },
  {
    id: 8,
    question: 'When learning geometry, I prefer to:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'See shapes and angles in diagrams and images',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Hear descriptions of shapes and their properties',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Draw and manipulate shapes myself',
      },
    ],
  },
  {
    id: 9,
    question: 'When I need to remember a math procedure, I:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Visualize the steps in my mind or on paper',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Say the steps to myself in order',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Go through the motions of solving it',
      },
    ],
  },
  {
    id: 10,
    question: 'If I had to teach someone a math concept, I would:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Show them pictures, graphs, or demonstrations',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Explain it step-by-step verbally',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Work through examples together hands-on',
      },
    ],
  },
  {
    id: 11,
    question: 'When I see a word problem, I first:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'Draw a picture or diagram of the situation',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'Read it aloud or rephrase it in my own words',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'Start working with numbers and trying solutions',
      },
    ],
  },
  {
    id: 12,
    question: 'I feel most confident in math when:',
    options: [
      {
        style: 'VISUAL',
        value: 'visual',
        text: 'I can see clear examples and visual patterns',
      },
      {
        style: 'AUDITORY',
        value: 'auditory',
        text: 'I understand the verbal explanation and logic',
      },
      {
        style: 'KINESTHETIC',
        value: 'kinesthetic',
        text: 'I\'ve practiced enough problems to feel comfortable',
      },
    ],
  },
];

// ====================================
// SCORING ALGORITHM
// ====================================

/**
 * Calculate learning style scores from questionnaire answers
 * 
 * @param answers - Map of question IDs to selected learning styles
 * @returns StyleScores object with counts for each style
 */
export function calculateStyleScores(
  answers: QuestionnaireAnswers
): StyleScores {
  const scores: StyleScores = {
    VISUAL: 0,
    AUDITORY: 0,
    KINESTHETIC: 0,
  };

  // Count occurrences of each style
  Object.values(answers).forEach((style: LearningStyle) => {
    scores[style]++;
  });

  return scores;
}

/**
 * Determine dominant learning style from scores
 * 
 * @param scores - StyleScores object
 * @returns The dominant learning style
 */
export function determineDominantStyle(scores: StyleScores): LearningStyle {
  // Find the style with the highest score
  const entries = Object.entries(scores) as [LearningStyle, number][];
  const dominant = entries.reduce((prev: [LearningStyle, number], current: [LearningStyle, number]) =>
    current[1] > prev[1] ? current : prev
  );

  return dominant[0];
}

/**
 * Get learning style from questionnaire answers (main function)
 * 
 * @param answers - Map of question IDs to selected learning styles
 * @returns The determined dominant learning style
 */
export function getLearningStyle(
  answers: QuestionnaireAnswers
): LearningStyle {
  const scores = calculateStyleScores(answers);
  return determineDominantStyle(scores);
}

/**
 * Get percentage breakdown of learning styles
 * Useful for showing students their learning style profile
 * 
 * @param scores - StyleScores object
 * @returns Object with percentages for each style
 */
export function getStylePercentages(scores: StyleScores): StyleScores {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);

  return {
    VISUAL: Math.round((scores.VISUAL / total) * 100),
    AUDITORY: Math.round((scores.AUDITORY / total) * 100),
    KINESTHETIC: Math.round((scores.KINESTHETIC / total) * 100),
  };
}

/**
 * Get learning style description
 * 
 * @param style - The learning style
 * @returns A description of how this learner learns best
 */
export function getStyleDescription(style: LearningStyle): string {
  const descriptions: Record<LearningStyle, string> = {
    VISUAL:
      'You learn best through visual aids like diagrams, charts, and images. You benefit from seeing information organized spatially and using color coding.',
    AUDITORY:
      'You learn best through listening and verbal explanations. You benefit from discussions, reading aloud, and hearing concepts explained step-by-step.',
    KINESTHETIC:
      'You learn best through hands-on practice and physical activity. You benefit from working through problems, using manipulatives, and learning by doing.',
  };

  return descriptions[style];
}

/**
 * Validate questionnaire answers
 * Ensures all questions are answered
 * 
 * @param answers - Map of question IDs to selected learning styles
 * @returns True if valid, false otherwise
 */
export function validateAnswers(answers: QuestionnaireAnswers): boolean {
  const expectedQuestionIds = learningStyleQuestionnaire.map((q) => q.id);
  const answeredQuestionIds = Object.keys(answers).map(Number);

  // Check if all questions are answered
  return expectedQuestionIds.every((id) => answeredQuestionIds.includes(id));
}
