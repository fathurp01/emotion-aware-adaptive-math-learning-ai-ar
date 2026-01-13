import { aiGenerateTextWithOptions } from '@/lib/gemini';

function stripUnsafe(input: string): string {
  return String(input || '').trim();
}

function sanitizeMarkdown(input: string): string {
  let text = stripUnsafe(input);

  // Remove fenced wrappers like ```markdown ... ```
  text = text.replace(/^```\s*markdown\s*/i, '');
  text = text.replace(/^```\s*/i, '');
  text = text.replace(/```\s*$/i, '');

  // Prefer $/$$ delimiters for markdown math parsing.
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n\n$$\n${inner}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`);

  return text.trim();
}

export type RemedialInput = {
  materialTitle: string;
  materialContent: string;
  learningStyle: 'VISUAL' | 'AUDITORY' | 'KINESTHETIC' | string;
  emotionLabel: 'Negative' | 'Neutral' | 'Positive' | string;
  lastAttempt?: {
    question: string;
    userAnswer: string;
    expectedAnswer?: string;
    aiFeedback?: string;
    score?: number;
  };
  recentSummary?: {
    wrongCount: number;
    avgScore: number;
  };
};

function buildRemedialPrompt(input: RemedialInput): string {
  const attempt = input.lastAttempt;
  const summary = input.recentSummary;

  return [
    'You are an adaptive and supportive middle school math tutor.',
    'Task: create PERSONAL remedial material for 1 student based on material + last quiz results.',
    'Goal: fix misconceptions, add examples, and give short exercises for quick understanding.',
    '',
    'Output rules:',
    '- English, friendly, concise but clear.',
    '- Tidy MARKDOWN format (title, summary, steps, example, exercises).',
    '- Do not add concepts outside material (if needed, add note "(Needs teacher confirmation)").',
    '- Include: 1 core summary, 1 example solved step-by-step, 2 exercises + short keys.',
    '- Adaptive based on emotion: if Negative, give support + small steps; if Positive, give slight challenge.',
    '- Adaptive based on learning style:',
    '  - VISUAL: use simple ASCII tables/diagrams if suitable.',
    '  - AUDITORY: use explanation style like a tutor narrator.',
    '  - KINESTHETIC: use small activities/number experiments to try.',
    '- For math: use $...$ inline and $$...$$ block.',
    '- Output only markdown (no JSON, no ```).',
    '',
    `EMOTION (last known): ${input.emotionLabel}`,
    `LEARNING STYLE: ${input.learningStyle}`,
    summary
      ? `PERFORMANCE SUMMARY: wrongCount=${summary.wrongCount}, avgScore=${Math.round(summary.avgScore)}`
      : 'PERFORMANCE SUMMARY: (not available)',
    '',
    `MATERIAL TITLE: ${input.materialTitle}`,
    '',
    'MATERIAL (concise, primary source):',
    stripUnsafe(input.materialContent).slice(0, 7000),
    '',
    attempt
      ? [
          'LAST QUIZ RESULTS:',
          `- Question: ${stripUnsafe(attempt.question).slice(0, 400)}`,
          `- Student answer: ${stripUnsafe(attempt.userAnswer).slice(0, 200)}`,
          attempt.expectedAnswer ? `- Expected answer: ${stripUnsafe(attempt.expectedAnswer).slice(0, 200)}` : '',
          typeof attempt.score === 'number' ? `- Score: ${attempt.score}` : '',
          attempt.aiFeedback ? `- System feedback: ${stripUnsafe(attempt.aiFeedback).slice(0, 400)}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'LAST QUIZ RESULTS: (not available)',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateRemedialMarkdown(input: RemedialInput): Promise<string> {
  const prompt = buildRemedialPrompt(input);
  const out = await aiGenerateTextWithOptions(prompt, {
    maxOutputTokens: 768,
    temperature: 0.2,
  });
  const cleaned = sanitizeMarkdown(out);

  // Safety: ensure we always return something usable
  if (cleaned.length < 200) {
    return [
      `# Remedial: ${input.materialTitle}`,
      '',
      'Sorry, remedial material cannot be generated automatically at this moment. Please try again or ask a teacher.',
    ].join('\n');
  }

  return cleaned;
}
