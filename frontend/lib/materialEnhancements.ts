import { createHash } from 'crypto';
import { aiGenerateText } from '@/lib/gemini';
import { z } from 'zod';

export type ArTemplate =
  | 'balance_scale'
  | 'number_line'
  | 'graph_2d'
  | 'fraction_blocks'
  | 'algebra_tiles'
  | 'generic_overlay';

export type ArRecipe = {
  version: 1;
  template: ArTemplate;
  title: string;
  shortGoal: string;
  steps: string[];
  overlay?: JsonObject;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

// ----------------------------
// AR overlay schemas (strict)
// ----------------------------

const zNumber = z.number().finite();

const zLinearEquationABC = z
  .object({
    a: zNumber,
    b: zNumber,
    c: zNumber,
  })
  .strict();

// Represents a 2-variable linear equation: a*x + b*y = c
// System graph: draw one or two equations and highlight intersection if solvable.
const zGraph2dLinearSystemOverlay = z
  .object({
    kind: z.literal('graph_2d_linear_system'),
    eq1: zLinearEquationABC,
    eq2: zLinearEquationABC.optional(),
    xRange: z.tuple([zNumber, zNumber]).optional(),
    yRange: z.tuple([zNumber, zNumber]).optional(),
    showIntersection: z.boolean().optional(),
    showGrid: z.boolean().optional(),
  })
  .strict();

const zBalanceScaleOverlay = z
  .object({
    kind: z.literal('balance_scale_equation'),
    left: z.string().min(1),
    right: z.string().min(1),
    highlight: z.string().optional(),
  })
  .strict();

const zNumberLineOverlay = z
  .object({
    kind: z.literal('number_line_overlay'),
    start: zNumber,
    jumps: z.array(zNumber).default([]),
    min: zNumber.optional(),
    max: zNumber.optional(),
  })
  .strict();

const zFractionBlocksOverlay = z
  .object({
    kind: z.literal('fraction_blocks_overlay'),
    fractions: z.array(z.string().regex(/^-?\d+\/\d+$/)).min(1).max(4),
  })
  .strict();

const zAlgebraTilesOverlay = z
  .object({
    kind: z.literal('algebra_tiles_overlay'),
    tiles: z.object({
      x2: zNumber.int(),
      x: zNumber.int(),
      constant: zNumber.int(),
    }),
    label: z.string().optional(),
  })
  .strict();

const zGenericOverlay = z
  .object({
    kind: z.literal('generic'),
    note: z.string().optional(),
  })
  .strict();

const zArOverlay = z.union([
  zGraph2dLinearSystemOverlay,
  zBalanceScaleOverlay,
  zNumberLineOverlay,
  zFractionBlocksOverlay,
  zAlgebraTilesOverlay,
  zGenericOverlay,
]);

const zArTemplate = z.enum([
  'balance_scale',
  'number_line',
  'graph_2d',
  'fraction_blocks',
  'algebra_tiles',
  'generic_overlay',
]);

const zArRecipeOutput = z
  .object({
    version: z.literal(1),
    template: zArTemplate,
    title: z.string().min(1).max(200),
    shortGoal: z.string().min(1).max(240),
    steps: z.array(z.string().min(3).max(220)).min(3).max(6),
    overlay: zArOverlay.optional(),
  })
  .strict();

function normalizeOverlay(input: unknown, template: ArTemplate): JsonObject {
  // We keep DB type as JsonObject, but validate & normalize shape.
  const fallback: JsonObject = { kind: 'generic', note: String(template) };

  if (!input || typeof input !== 'object') return fallback;

  const parsed = zArOverlay.safeParse(input);
  if (parsed.success) return parsed.data as unknown as JsonObject;

  // Best-effort: if template suggests a graph but overlay invalid, fallback to generic.
  return fallback;
}

function normalizeRecipe(candidate: Partial<ArRecipe>, fallbackTitle: string): ArRecipe | null {
  const template = candidate.template as ArTemplate | undefined;
  const steps = Array.isArray(candidate.steps)
    ? (candidate.steps.filter((s) => typeof s === 'string') as string[])
    : [];

  if (!template || steps.length < 3) return null;

  const normalized: ArRecipe = {
    version: 1,
    template,
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : fallbackTitle,
    shortGoal:
      typeof candidate.shortGoal === 'string' && candidate.shortGoal.trim()
        ? candidate.shortGoal.trim()
        : 'Short interactive exercise.',
    steps: steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6),
    overlay: normalizeOverlay(candidate.overlay, template),
  };

  // Validate against strict schema (overlay union is strict too)
  const parsed = zArRecipeOutput.safeParse({
    ...normalized,
    overlay: normalized.overlay,
  });
  if (!parsed.success) return null;

  return {
    version: 1,
    template: parsed.data.template,
    title: parsed.data.title,
    shortGoal: parsed.data.shortGoal,
    steps: parsed.data.steps,
    overlay: parsed.data.overlay as unknown as JsonObject,
  };
}

async function aiValidateAndFixArRecipe(
  aiRecipeRaw: unknown,
  systemRecipe: ArRecipe
): Promise<{ ok: true } | { ok: false; corrected?: ArRecipe; reason: string }> {
  const prompt = [
    'You are a VALIDATOR for AR configuration (very strict).',
    'Task: compare 2 JSONs:',
    '- aiRecipeRaw: previous AI result (maybe messy)',
    '- systemRecipe: system normalized + validated result (this will be used by renderer).',
    '',
    'Check:',
    '1) systemRecipe conforms to schema & can be rendered by system without error.',
    '2) systemRecipe is consistent with aiRecipeRaw intent (template & overlay do not contradict).',
    '3) For SPLDV/system of equations: if there are 2 equations, use template graph_2d + overlay.kind graph_2d_linear_system, and fill eq1/eq2 coefficients.',
    '',
    'Output MUST be valid JSON WITHOUT markdown, one of:',
    '{"status":"ok"}',
    '{"status":"fix","reason":"...","recipe":{...}}',
    '',
    'Strict recipe schema:',
    '{"version":1,"template":"balance_scale|number_line|graph_2d|fraction_blocks|algebra_tiles|generic_overlay","title":"...","shortGoal":"...","steps":[...],"overlay":{...}}',
    'Strict overlay schema:',
    '- graph_2d_linear_system: {"kind":"graph_2d_linear_system","eq1":{"a":number,"b":number,"c":number},"eq2":{"a":number,"b":number,"c":number}?,"xRange":[min,max]?,"yRange":[min,max]?,"showIntersection":true?,"showGrid":true?}',
    '- balance_scale_equation: {"kind":"balance_scale_equation","left":"string","right":"string","highlight":"string"?}',
    '- number_line_overlay: {"kind":"number_line_overlay","start":number,"jumps":[number...],"min":number?,"max":number?}',
    '- fraction_blocks_overlay: {"kind":"fraction_blocks_overlay","fractions":["1/2","3/4"...]}',
    '- algebra_tiles_overlay: {"kind":"algebra_tiles_overlay","tiles":{"x2":number,"x":number,"constant":number},"label":"string"?}',
    '- generic: {"kind":"generic","note":"string"?}',
    '',
    'aiRecipeRaw:',
    JSON.stringify(aiRecipeRaw),
    '',
    'systemRecipe:',
    JSON.stringify(systemRecipe),
  ].join('\n');

  const out = await aiGenerateText(prompt);
  const jsonText = extractJson(out);
  const parsed = JSON.parse(jsonText) as { status?: string; reason?: string; recipe?: unknown };

  if (parsed?.status === 'ok') return { ok: true };

  const reason = typeof parsed?.reason === 'string' && parsed.reason.trim()
    ? parsed.reason.trim()
    : 'Validator requested fix.';

  if (parsed?.status === 'fix' && parsed.recipe) {
    const maybe = normalizeRecipe(parsed.recipe as Partial<ArRecipe>, systemRecipe.title);
    if (maybe) return { ok: false, corrected: maybe, reason };
  }

  return { ok: false, reason };
}

export function computeContentVersion(content: string): string {
  return createHash('sha256').update(content ?? '', 'utf8').digest('hex');
}

function stripText(input: string): string {
  return (input || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function audioScriptFallback(title: string, content: string): string {
  const clean = stripText(content);
  const base = clean.length > 0 ? clean : title;
  return base.slice(0, 1400);
}

function inferTemplate(content: string): ArTemplate {
  const t = stripText(content).toLowerCase();
  // SPLDV/SPLTV or explicit "system of equations" is best represented as a graph overlay (two lines + intersection)
  if (/system of equations|spldv|spl\s*dv|two variables|x\s*and\s*y|simultaneous equations/.test(t)) return 'graph_2d';
  if (/fraction|ratio|proportion/.test(t)) return 'fraction_blocks';
  if (/graph|coordinate|cartesian|gradient|straight line|function/.test(t)) return 'graph_2d';
  if (/equation|system of equations|spltv|spldv|linear/.test(t)) return 'balance_scale';
  if (/number|number line|positive|negative|integer|arithmetic operation/.test(t)) return 'number_line';
  if (/factorization|algebra|variable|x\b|y\b/.test(t)) return 'algebra_tiles';
  return 'generic_overlay';
}

export function arRecipeFallback(title: string, content: string): ArRecipe {
  const template = inferTemplate(content);
  const clean = stripText(content);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const steps = (sentences.length ? sentences : [clean])
    .filter((s) => s.length >= 12)
    .slice(0, 5)
    .map((s, i) => {
      const lead = i === 0 ? 'Observe' : i === 1 ? 'Try' : 'Continue';
      return `${lead}: ${s}`;
    });

  let overlay: JsonObject;
  
  switch (template) {
    case 'balance_scale':
      overlay = { kind: 'balance_scale_equation', left: '2x + 1', right: '5' } as unknown as JsonObject;
      break;
    case 'number_line':
      overlay = { kind: 'number_line_overlay', start: 0, jumps: [2, 3], min: -2, max: 8 } as unknown as JsonObject;
      break;
    case 'fraction_blocks':
      overlay = { kind: 'fraction_blocks_overlay', fractions: ['1/2', '1/3'] } as unknown as JsonObject;
      break;
    case 'algebra_tiles':
      overlay = { kind: 'algebra_tiles_overlay', tiles: { x2: 1, x: 2, constant: 1 } } as unknown as JsonObject;
      break;
    case 'graph_2d':
      overlay = { 
        kind: 'graph_2d_linear_system', 
        eq1: { a: 1, b: -1, c: 0 }, // x - y = 0
        eq2: { a: 1, b: 1, c: 4 },  // x + y = 4 => (2,2)
        showIntersection: true 
      } as unknown as JsonObject;
      break;
    default:
      overlay = { kind: 'generic', note: String(template) } as unknown as JsonObject;
      break;
  }

  return {
    version: 1,
    template,
    title,
    shortGoal: 'Short interactive exercises with camera + overlay.',
    steps: steps.length ? steps : ['Observe: Read core concepts in text.', 'Try: Work on 1 example problem.', 'Continue: Change numbers in example and observe changes.'],
    overlay,
  };
}

function extractJson(text: string): string {
  const cleaned = String(text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
  return cleaned;
}

export async function generateAudioScript(title: string, content: string): Promise<string> {
  const prompt = [
    'You are a middle school math teacher assistant.',
    'Task: create audio script (for TTS) from the following material.',
    'Rules:',
    '- English, clear, friendly, do not add new facts.',
    '- Focus on reading the existing content with a structure that is pleasant to hear.',
    '- Max 1200 characters.',
    '- Output only script text, no markdown, no weird bullets.',
    '',
    `TITLE: ${title}`,
    '',
    'MATERIAL:',
    stripText(content).slice(0, 6000),
  ].join('\n');

  try {
    const out = await aiGenerateText(prompt);
    const cleaned = stripText(out);
    return cleaned.slice(0, 1400) || audioScriptFallback(title, content);
  } catch {
    return audioScriptFallback(title, content);
  }
}

export async function generateArRecipe(title: string, content: string): Promise<ArRecipe> {
  const suggestedTemplate = inferTemplate(content);
  const hint = stripText(content).toLowerCase();
  const looksLikeSystem = /system of equations|spldv|spl\s*dv|two variables/.test(hint);
  const basePrompt = [
    'You are a WebAR activity designer for middle school math.',
    'Create 1 AR recipe based on template (no free 3D).',
    'Choose only one of these templates suitable for the MATERIAL:',
    '- balance_scale (equations, left=right)',
    '- number_line (integer operations)',
    '- graph_2d (linear functions, systems)',
    '- fraction_blocks (visualizing fractions)',
    '- algebra_tiles (polynomials, factoring)',
    '- generic_overlay (fallback)',
    '',
    'IMPORTANT: Output MUST be valid JSON (no markdown).',
    'MANDATORY Structure:',
    '{"version":1,"template":"...","title":"...","shortGoal":"...","steps":["..."],"overlay":{...}}',
    'Rules:',
    '- steps 3-6 steps, short sentences, actionable.',
    '- Do not add concepts that are not in the material.',
    '- overlay MUST follow the template schema below (strict).',
    '',
    'Overlay SCHEMA (strict):',
    '- graph_2d_linear_system: {"kind":"graph_2d_linear_system","eq1":{"a":number,"b":number,"c":number},"eq2":{"a":number,"b":number,"c":number}?,"xRange":[min,max]?,"yRange":[min,max]?,"showIntersection":true?,"showGrid":true?}',
    '- balance_scale_equation: {"kind":"balance_scale_equation","left":"string expression","right":"string expression","highlight":"string hint?"}',
    '- number_line_overlay: {"kind":"number_line_overlay","start":number,"jumps":[...],"min":number?,"max":number?}',
    '- fraction_blocks_overlay: {"kind":"fraction_blocks_overlay","fractions":["1/2","3/4"...] (max 4)}',
    '- algebra_tiles_overlay: {"kind":"algebra_tiles_overlay","tiles":{"x2":number,"x":number,"constant":number},"label":"string"?}',
    '- generic: {"kind":"generic","note":"string"?}',
    '',
    `Suggested template (may follow if suitable): ${suggestedTemplate}`,
    '',
    `TITLE: ${title}`,
    '',
    'MATERIAL:',
    stripText(content).slice(0, 7000),
  ].join('\n');

  const maxAttempts = 3;
  let lastSystem: ArRecipe | null = null;
  let lastRaw: unknown = null;
  let lastReason = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : [
            basePrompt,
            '',
            'NOTE corrections from previous validator:',
            lastReason || '(none)',
            '',
            'Please re-generate correct JSON that conforms to schema.',
          ].join('\n');

    try {
      const out = await aiGenerateText(prompt);
      const jsonText = extractJson(out);
      const parsed = JSON.parse(jsonText) as Partial<ArRecipe>;
      lastRaw = parsed;

      const systemRecipe = normalizeRecipe(parsed, title);
      if (!systemRecipe) {
        lastReason = 'Normalization/schema validation failed.';
        continue;
      }

      lastSystem = systemRecipe;

      // AI double-check: ensure the normalized config still matches intent & is runnable.
      const verdict = await aiValidateAndFixArRecipe(parsed, systemRecipe);
      if (verdict.ok) return systemRecipe;

      lastReason = verdict.reason;
      if (verdict.corrected) {
        // If validator provided a corrected recipe, re-check schema and accept.
        const correctedVerdict = await aiValidateAndFixArRecipe(verdict.corrected, verdict.corrected);
        if (correctedVerdict.ok) return verdict.corrected;
        lastReason = correctedVerdict.ok ? '' : correctedVerdict.reason;
        lastSystem = verdict.corrected;
      }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : 'Failed to generate AR recipe';
      continue;
    }
  }

  // Final fallback if repeated attempts failed.
  if (lastSystem) return lastSystem;
  if (lastRaw && typeof lastRaw === 'object') {
    const maybe = normalizeRecipe(lastRaw as Partial<ArRecipe>, title);
    if (maybe) return maybe;
  }
  return arRecipeFallback(title, content);
}

export async function generateArExplanation(input: {
  title: string;
  content: string;
  arRecipe: unknown;
}): Promise<string> {
  const { title, content, arRecipe } = input;

  const recipe = (arRecipe && typeof arRecipe === 'object' ? (arRecipe as any) : null) as any | null;
  const template = typeof recipe?.template === 'string' ? recipe.template : 'generic_overlay';
  const overlayKind = typeof recipe?.overlay?.kind === 'string' ? recipe.overlay.kind : undefined;

  const prompt = [
    'You are a tutor explaining AR view to a beginner (concise and compact).',
    'Create a 2-4 sentence explanation in English, no bullets, no markdown.',
    'Goal: user who just learned immediately understands what is seen in AR and its meaning.',
    'Do not discuss technical WebXR/camera. Focus on visual meaning.',
    '',
    'If template = graph_2d and overlay.kind = graph_2d_linear_system:',
    '- Explain that two lines represent two equations',
    '- Intersection point = solution (x,y)',
    '- Mention red/blue lines if relevant',
    '',
    'If template = balance_scale:',
    '- Explain left/right balance as equation',
    '- Goal is to balance operations on both sides',
    '',
    'If template = number_line:',
    '- Explain number line & move left/right',
    '',
    'If template = fraction_blocks:',
    '- Explain fraction blocks as parts of a whole',
    '',
    'If template = algebra_tiles:',
    '- Explain tiles represent x², x, and 1 to build algebraic expressions',
    '',
    `Material Title: ${title}`,
    `Template: ${template}`,
    `Overlay kind: ${overlayKind || '-'}`,
    '',
    'AR recipe JSON:',
    JSON.stringify(arRecipe),
    '',
    'Material Snippet (concise):',
    stripText(content).slice(0, 1200),
  ].join('\n');

  try {
    const out = await aiGenerateText(prompt);
    const cleaned = stripText(out)
      .replace(/\s+/g, ' ')
      .replace(/^"|"$/g, '')
      .trim();

    if (cleaned.length >= 40) return cleaned.slice(0, 320);
  } catch {
    // ignore
  }

  // Deterministic fallback (no AI)
  if (template === 'graph_2d') {
    return 'This graph displays equations as lines. If there are two lines, the intersection point is the solution (x,y) satisfying both equations.';
  }
  if (template === 'balance_scale') {
    return 'The scale represents an equation: both sides must be balanced. When you change one side, do the same to the other side to keep it equal.';
  }
  if (template === 'number_line') {
    return 'The number line helps visualize operations as shifts: to the right for addition and to the left for subtraction. The end point shows the result.';
  }
  if (template === 'fraction_blocks') {
    return 'Fraction blocks show parts of a whole. Colored parts help compare and simplify fractions visually.';
  }
  if (template === 'algebra_tiles') {
    return 'Algebra tiles represent x², x, and 1. By arranging and grouping tiles, you can see algebraic forms and their simplification visually.';
  }
  return 'This AR view helps you understand concepts with simple visuals. Follow the on-screen instructions to connect the image with solution steps.';
}
