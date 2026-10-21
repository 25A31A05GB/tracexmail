/**
 * TraceXMail Design System - Border Radius Tokens
 * Governed by Design Prompt D:
 * - radii 6/10/14
 */

export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  full: '9999px',
} as const;

export type RadiiTokens = typeof radii;
