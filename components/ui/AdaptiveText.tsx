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
  // Process content based on simplification mode
  const processedContent = useMemo(() => {
    if (!isSimplified) {
      return content;
    }

    // Simplification logic:
    // 1. Break long paragraphs into shorter ones
    // 2. Add more spacing
    // 3. Highlight key terms
    
    return content
      .split('\n\n')
      .map((paragraph) => {
        // Split long sentences
        const sentences = paragraph.split('. ');
        return sentences.join('.\n\n');
      })
      .join('\n\n');
  }, [content, isSimplified]);

  return (
    <div
      className={`
        adaptive-text prose prose-lg max-w-none
        ${isSimplified ? 'prose-xl leading-relaxed' : ''}
        ${className}
      `}
    >
      {/* Render content with adaptive styling */}
      <div
        className={`
          ${isSimplified ? 'space-y-6' : 'space-y-4'}
          transition-all duration-300
        `}
        style={{
          fontSize: isSimplified ? '1.125rem' : '1rem',
          lineHeight: isSimplified ? '2' : '1.75',
        }}
        dangerouslySetInnerHTML={{
          __html: formatContent(processedContent, isSimplified),
        }}
      />

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

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Format content for display
 * Converts markdown-like syntax to HTML
 * Highlights key mathematical terms
 */
function formatContent(content: string, isSimplified: boolean): string {
  let formatted = content;

  // Convert line breaks to <p> tags
  formatted = formatted
    .split('\n\n')
    .map((para) => `<p>${para.trim()}</p>`)
    .join('');

  // Bold text: **text** -> <strong>text</strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic text: *text* -> <em>text</em>
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Highlight mathematical terms (if simplified mode)
  if (isSimplified) {
    const mathTerms = [
      'sum',
      'product',
      'difference',
      'quotient',
      'equation',
      'formula',
      'variable',
      'constant',
      'coefficient',
      'persamaan',
      'rumus',
      'variabel',
      'konstanta',
    ];

    mathTerms.forEach((term) => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      formatted = formatted.replace(
        regex,
        '<span class="font-semibold text-blue-600 bg-blue-50 px-1 rounded">$1</span>'
      );
    });
  }

  return formatted;
}
