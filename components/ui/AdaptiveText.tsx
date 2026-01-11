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

import { useMemo } from 'react';
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
    // Keep markdown structure intact; Easy-Read is handled via styling.
    return sanitizeAiMarkdown(content);
  }, [content]);

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
