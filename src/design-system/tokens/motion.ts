/**
 * TraceXMail Design System - Motion Tokens
 * Governed by Design Prompt D:
 * - Motion 150 / 250 / 400ms
 * - One easing curve: cubic-bezier(0.16, 1, 0.3, 1)
 * - Honor prefers-reduced-motion
 * - No looping animation
 */

export const motion = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  easing: {
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  reducedMotion: {
    duration: '0ms',
  },
} as const;

export type MotionTokens = typeof motion;
