/**
 * TraceXMail Design System - Color Tokens
 * Governed by Design Prompt D2:
 * - Surfaces: page #100e0c, section #14110d, card #171410, raised #1d1a15
 * - Border: #3a352c
 * - Text: primary #ede6d8, secondary #b9af9c, muted #8e8574, inverse #100e0c
 * - Brand & Primary Action: gold #c9a227 (hover #d8b035)
 * - Verified: green #22c55e (text #4ade80, deep fill #2e7a4a)
 * - Alert: red #b23a2e (text #ff8d7d for 4.5:1 AA contrast on dark)
 * - Anomaly / Warning: orange #fb923c (solid #f97316)
 * - Neutral Information: stone #b9af9c
 * - REMOVED: teal/cyan, violet/purple, blue, slate, emerald
 */

export const colors = {
  // Core Surfaces
  surface: {
    page: '#100e0c',
    section: '#14110d',
    card: '#171410',
    raised: '#1d1a15',
  },

  // Borders & Dividers
  border: {
    default: '#3a352c',
    subtle: 'rgba(58, 53, 44, 0.5)',
    focus: '#c9a227',
  },

  // Typography
  text: {
    primary: '#ede6d8',
    secondary: '#b9af9c',
    muted: '#8e8574',
    inverse: '#100e0c',
  },

  // Brand Accent (Used strictly on primary actions, active nav, max 1 highlight per screen)
  accent: {
    gold: '#c9a227',
    goldHover: '#d8b035',
    goldMuted: 'rgba(201, 162, 39, 0.12)',
    goldBorder: '#5e4710',
  },

  // Semantic Forensics Status Colors (D2 Palette: Verified Green, Anomaly Orange, Alert Red, Stone Info)
  semantic: {
    // Verified / Safe / Legitimate
    verified: {
      solid: '#22c55e',
      deep: '#2e7a4a',
      subtle: 'rgba(34, 197, 94, 0.12)',
      border: '#2e7a4a',
      text: '#4ade80',
    },
    // Anomaly / Warning (Orange - clearly distinct from gold)
    anomaly: {
      solid: '#f97316',
      subtle: 'rgba(249, 115, 22, 0.12)',
      border: '#9a3412',
      text: '#fb923c',
    },
    // Alert / Threat / Phishing / Quarantined (Red text #ff8d7d meets 4.5:1 WCAG AA)
    alert: {
      solid: '#b23a2e',
      hover: '#c94a3d',
      subtle: 'rgba(178, 58, 46, 0.12)',
      border: '#b23a2e',
      text: '#ff8d7d',
    },
    // Neutral Information (Stone outline + icon, replaces teal and violet)
    info: {
      solid: '#b9af9c',
      subtle: 'rgba(185, 175, 156, 0.12)',
      border: '#3a352c',
      text: '#b9af9c',
    },
  },

  // Elevation Shadows (No glow effects, max 2 levels)
  elevation: {
    level1: '0 4px 12px rgba(0, 0, 0, 0.4)',
    level2: '0 12px 32px rgba(0, 0, 0, 0.6)',
  },
} as const;

export const colorTokens = colors;
export type ColorTokens = typeof colors;
