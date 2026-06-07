import { prisma } from '@/lib/db';
import { createHash } from 'crypto';
import { aiGenerateTextWithOptions } from '@/lib/gemini';

function sha256(input: string): string {
  return createHash('sha256').update(input ?? '', 'utf8').digest('hex');
}

function stripUnsafe(input: string): string {
  return String(input || '').trim();
}

function sanitizeRefinedMarkdown(input: string): string {
  let text = stripUnsafe(input);

  // Remove fenced wrappers like ```markdown ... ```
  text = text.replace(/^```\s*markdown\s*/i, '');
  text = text.replace(/^```\s*/i, '');
  text = text.replace(/```\s*$/i, '');

  // Prefer $/$$ delimiters for better markdown math parsing.
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n\n$$\n${inner}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`);

  return text.trim();
}

function buildRefinePrompt(title: string, content: string): string {
  return [
    'You are a middle school math material editor.',
    'Task: tidy up and restructure the following material to be clear, coherent, and complete for students.',
    'Rules:',
    '- English, do not add new facts/concepts.',
    '- Result in tidy MARKDOWN format: title, learning objectives, core concepts, solution steps, at least 2 examples, and 3 exercises + Answer Key (strictly in LaTeX format like $x=5$).',
    '- Minimum 800 words or minimum 2500 characters (do not make it too short).',
    '- Do not hallucinate; if something is unclear, write a short note "(Needs teacher confirmation)".',
    '- For math: use delimiter $...$ for inline and $$...$$ for block (avoid \\(...\\) and \\[...\\]).',
    '- Do not wrap output with ```markdown or ```.',
    '- Output only markdown, no JSON.',
    '',
    `TITLE: ${title}`,
    '',
    'ORIGINAL MATERIAL:',
    stripUnsafe(content).slice(0, 9000),
  ].join('\n');
}

export type PrecomputeOptions = {
  /** Max number of materials to refine per run (safety). */
  limit?: number;
  /** If true, also regenerate even if refinedAt exists. Defaults to false. */
  force?: boolean;
};

let hasStarted = false;

/**
 * Precompute (refine) material content once and persist to DB.
 *
 * Behavior:
 * - Only refines materials with refinedAt == null (unless force=true).
 * - Stores the refined markdown back into Material.content.
 * - Updates contentVersion and refinedAt.
 *
 * This makes the content stable for all users (global per material).
 */
export async function precomputeMaterialContent(options?: PrecomputeOptions): Promise<{ updated: number; skipped: number; errors: number }> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? 50));
  const force = Boolean(options?.force);

  const materials = await prisma.material.findMany({
    where: force ? {} : { refinedAt: null },
    select: { id: true, title: true, content: true, refinedAt: true },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const m of materials) {
    try {
      if (!force && m.refinedAt) {
        skipped++;
        continue;
      }

      const prompt = buildRefinePrompt(m.title, m.content);
      const maxTokensRaw = process.env.MATERIAL_REFINE_MAX_OUTPUT_TOKENS;
      const maxOutputTokens = maxTokensRaw ? Number.parseInt(maxTokensRaw, 10) : 1536;

      const refinedRaw = await aiGenerateTextWithOptions(prompt, {
        maxOutputTokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1536,
        temperature: 0.2,
      });
      const refined = sanitizeRefinedMarkdown(refinedRaw);

      // Safety: don't wipe content if model returns empty.
      const nextContent = refined.length >= 400 ? refined : m.content;

      await prisma.material.update({
        where: { id: m.id },
        data: {
          content: nextContent,
          contentVersion: sha256(nextContent),
          refinedAt: new Date(),
        },
      });

      updated++;
    } catch {
      errors++;
    }
  }

  return { updated, skipped, errors };
}

/**
 * Best-effort startup hook. Never throws.
 *
 * Controlled by env:
 * - MATERIAL_PRECOMPUTE_ON_STARTUP=1 to enable
 * - MATERIAL_PRECOMPUTE_LIMIT=50 (optional)
 */
export function kickOffMaterialPrecomputeOnStartup(): void {
  if (hasStarted) return;
  hasStarted = true;

  const enabled = /^(1|true|yes)$/i.test(String(process.env.MATERIAL_PRECOMPUTE_ON_STARTUP || ''));
  if (!enabled) return;

  const limitRaw = process.env.MATERIAL_PRECOMPUTE_LIMIT;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;

  // Fire-and-forget. Do not block server start.
  void (async () => {
    try {
      const startedAt = Date.now();
      const res = await precomputeMaterialContent({ limit: Number.isFinite(limit) ? limit : 50 });
      const ms = Date.now() - startedAt;
      // eslint-disable-next-line no-console
      console.log(
        `[startup] material precompute done in ${ms}ms (updated=${res.updated}, skipped=${res.skipped}, errors=${res.errors})`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[startup] material precompute failed (ignored):', err);
    }
  })();
}
