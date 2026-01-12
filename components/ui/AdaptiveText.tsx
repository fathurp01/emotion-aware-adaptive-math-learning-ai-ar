/**
 * AdaptiveText Component
 * 
 * This component renders text content that adapts based on student's emotional state.
 * 
 * Features:
 * - Simplifies text when student is anxious/confused
 * - Applies visual effects (larger font, better spacing)
 * - Highlights key concepts
 * - Supports markdown content
 */

'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ====================================
// TYPE DEFINITIONS
// ====================================

interface AdaptiveTextProps {
  content: string;
  isSimplified: boolean;
  className?: string;
}

// ====================================
// COMPONENT
// ====================================

export default function AdaptiveText({
  content,
  isSimplified,
  className = '',
}: AdaptiveTextProps) {
  const processedContent = useMemo(() => {
    // Keep markdown structure intact; Easy-Read is handled via styling + rendering.
    return sanitizeAiMarkdown(content);
  }, [content]);

  const enableEasyReadHighlights = isSimplified;

  return (
    <div
      className={`
        adaptive-text prose prose-lg max-w-none
        ${isSimplified ? 'prose-xl leading-relaxed' : ''}
        ${className}
      `}
    >
      <div
        className={`
          ${isSimplified ? 'space-y-6' : 'space-y-4'}
          transition-all duration-300
        `}
        style={{
          fontSize: isSimplified ? '1.125rem' : '1rem',
          lineHeight: isSimplified ? '2' : '1.75',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={
            enableEasyReadHighlights
              ? {
                  h1: ({ children }) => (
                    <h1 className="scroll-mt-24">
                      <span className="inline-block rounded-lg bg-yellow-100 px-2 py-1 text-yellow-950 ring-1 ring-yellow-200">
                        {children}
                      </span>
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="scroll-mt-24">
                      <span className="inline-block rounded-lg bg-yellow-100 px-2 py-1 text-yellow-950 ring-1 ring-yellow-200">
                        {children}
                      </span>
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="scroll-mt-24">
                      <span className="inline-block rounded-md bg-yellow-100 px-2 py-1 text-yellow-950 ring-1 ring-yellow-200">
                        {children}
                      </span>
                    </h3>
                  ),
                  strong: ({ children }) => (
                    <strong className="rounded bg-yellow-200/70 px-1 py-0.5 text-yellow-950">
                      {children}
                    </strong>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-yellow-300 bg-yellow-50/60 px-4 py-2 text-slate-800">
                      {children}
                    </blockquote>
                  ),
                  p: ({ children }) => <p>{highlightChildren(children)}</p>,
                  li: ({ children }) => <li>{highlightChildren(children)}</li>,
                }
              : undefined
          }
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Simplified Mode Indicator */}
      {isSimplified && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            ℹ️ This content is displayed in <strong>Easy-Read Mode</strong> to help
            you understand better.
          </p>
        </div>
      )}
    </div>
  );
}

function sanitizeAiMarkdown(input: string): string {
  let text = String(input || '').trim();

  // Some models wrap markdown in a fenced block like ```markdown ... ```.
  text = text.replace(/^```\s*markdown\s*/i, '');
  text = text.replace(/^```\s*/i, '');
  text = text.replace(/```\s*$/i, '');

  // Convert \[...\] and \(...\) into $$...$$ and $...$ so remark-math can parse.
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n\n$$\n${inner}\n$$\n\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`);

  return text.trim();
}

const EASY_READ_GLOSSARY: Record<string, string> = {
  // Keep this list intentionally small: only high-signal concepts.
  'sistem persamaan linear dua variabel':
    'SPLDV adalah dua persamaan linear yang melibatkan dua variabel yang sama (mis. x dan y).',
  spldv:
    'Singkatan dari Sistem Persamaan Linear Dua Variabel (SPLDV).',
  'bentuk umum':
    'Bentuk umum SPLDV biasanya ditulis sebagai: a₁x + b₁y = c₁ dan a₂x + b₂y = c₂.',
  substitusi:
    'Metode substitusi: ubah satu persamaan menjadi x = ... atau y = ..., lalu substitusikan ke persamaan lain.',
  eliminasi:
    'Metode eliminasi: samakan koefisien salah satu variabel, lalu jumlah/kurangi persamaan untuk menghilangkan variabel itu.',
  koefisien:
    'Koefisien adalah angka pengali variabel (mis. pada 3x, koefisien x adalah 3).',
};

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EASY_READ_HIGHLIGHT_RE = new RegExp(
  [
    // Phrases/terms
    ...Object.keys(EASY_READ_GLOSSARY)
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((t) => escapeRegex(t).replace(/\s+/g, '\\s+')),
  ].join('|'),
  'gi'
);

function normalizeTerm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function highlightText(text: string): ReactNode {
  if (!text) return text;

  // Avoid creating tons of nodes for very long strings.
  if (text.length > 8000) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(EASY_READ_HIGHLIGHT_RE)) {
    const index = match.index ?? 0;
    const value = match[0] ?? '';
    if (!value) continue;

    const keyTerm = normalizeTerm(value);
    const explanation = EASY_READ_GLOSSARY[keyTerm];
    if (!explanation) {
      // Not in glossary (should be rare), skip so we don't over-highlight.
      continue;
    }

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    parts.push(
      <span
        key={`mk-${key++}`}
        title={explanation}
        aria-label={explanation}
        className="rounded px-1 py-0.5 underline decoration-dotted decoration-yellow-500 underline-offset-4 cursor-help transition-colors hover:bg-yellow-200/70 hover:text-yellow-950"
      >
        {value}
      </span>
    );

    lastIndex = index + value.length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function highlightChildren(children: ReactNode): ReactNode {
  // We highlight only text nodes, and recurse into common inline wrappers.
  // Skip code blocks/inline code so tokens don't get marked.
  return Children.map(children, (child) => {
    if (typeof child === 'string') return highlightText(child);
    if (!isValidElement(child)) return child;

    const type = child.type;
    if (type === 'code' || type === 'pre' || type === 'a') return child;

    const childProps = child.props as { children?: ReactNode };
    if (!childProps?.children) return child;

    return cloneElement(child, {
      children: highlightChildren(childProps.children),
    });
  });
}
