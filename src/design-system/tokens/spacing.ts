/**
 * TraceXMail Design System - Spacing Tokens
 * Governed by Design Prompt D:
 * - 4px base spacing with an 8px rhythm
 */

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const layout = {
  maxWidth: '1200px',
  containerPaddingMobile: '16px',
  containerPaddingDesktop: '32px',
  gridColumns: 12,
  gridGutter: '24px',
} as const;

export type SpacingTokens = typeof spacing;
