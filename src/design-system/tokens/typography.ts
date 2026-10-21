/**
 * TraceXMail Design System - Typography Tokens
 * Governed by Design Prompt D:
 * - One serif (Source Serif 4) for headings
 * - Sans for body (IBM Plex Sans)
 * - Mono for technical values (JetBrains Mono)
 * - Noto fallbacks for international non-Latin scripts (Devanagari, Arabic, CJK, Cyrillic, Greek)
 * - Type scale: 12 / 14 / 16 / 20 / 28 / 40
 * - Tabular numerals for metrics
 */

export const typography = {
  fonts: {
    heading: [
      'Source Serif 4',
      'Noto Serif',
      'Noto Serif Devanagari',
      'Noto Serif Arabic',
      'Noto Serif SC',
      'Noto Serif TC',
      'Noto Serif JP',
      'Georgia',
      'serif'
    ].join(', '),

    body: [
      'IBM Plex Sans',
      'Noto Sans',
      'Noto Sans Devanagari',
      'Noto Sans Arabic',
      'Noto Sans SC',
      'Noto Sans TC',
      'Noto Sans JP',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif'
    ].join(', '),

    mono: [
      'JetBrains Mono',
      'Noto Sans Mono',
      'ui-monospace',
      'SFMono-Regular',
      'Menlo',
      'Monaco',
      'Consolas',
      'monospace'
    ].join(', '),
  },

  // Type Scale (font-size / line-height)
  scale: {
    12: {
      fontSize: '12px',
      lineHeight: '16px',
      letterSpacing: '0.01em',
    },
    14: {
      fontSize: '14px',
      lineHeight: '20px',
      letterSpacing: '0',
    },
    16: {
      fontSize: '16px',
      lineHeight: '24px',
      letterSpacing: '-0.005em',
    },
    20: {
      fontSize: '20px',
      lineHeight: '28px',
      letterSpacing: '-0.01em',
    },
    28: {
      fontSize: '28px',
      lineHeight: '36px',
      letterSpacing: '-0.02em',
    },
    40: {
      fontSize: '40px',
      lineHeight: '48px',
      letterSpacing: '-0.025em',
    },
  },

  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  tabularNums: {
    fontVariantNumeric: 'tabular-nums',
  },
} as const;

export type TypographyTokens = typeof typography;
