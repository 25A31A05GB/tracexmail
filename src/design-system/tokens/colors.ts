/**
 * TraceXMail Design System - Color Tokens
 * Governed by Design Prompt D:
 * - Surfaces: page #100e0c, section #14110d, card #171410
 * - Border: #3a352c
 * - Text: #ede6d8, muted #8a8070, secondary #94a3b8
 * - Accent: gold #c9a227 (primary button, active nav, max 1 highlight per screen)
 * - Semantic: green (verified), amber (anomaly), red (alert), violet (destination), teal (intelligence)
 */

export const colors = {
  // Core Surfaces
  surface: {
    page: '#100e0c',
    section: '#14110d',
    card: '#171410',
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
    muted: '#8a8070',
    secondary: '#94a3b8',
    inverse: '#100e0c',
  },

  // Brand Accent (Used strictly on primary actions, active nav, max 1 highlight per screen)
  accent: {
    gold: '#c9a227',
    goldHover: '#dec052',
    goldMuted: 'rgba(201, 162, 39, 0.12)',
    goldBorder: '#5e4710',
  },

  // Semantic Forensics Status Colors (solid, subtle-background, and border variants)
  semantic: {
    // Verified / Safe / Legitimate
    verified: {
      solid: '#48a975',
      subtle: 'rgba(72, 169, 117, 0.12)',
      border: '#275c3f',
      text: '#48a975',
    },
    // Anomaly / Warning / Suspicious
    anomaly: {
      solid: '#c9a227',
      subtle: 'rgba(201, 162, 39, 0.12)',
      border: '#5e4710',
      text: '#c9a227',
    },
    // Alert / Threat / Phishing / Quarantined
    alert: {
      solid: '#b23a2e',
      subtle: 'rgba(178, 58, 46, 0.12)',
      border: '#5a1e17',
      text: '#f1a39b',
    },
    // Destination / Delivery / Hop Route
    destination: {
      solid: '#8c58b0',
      subtle: 'rgba(140, 88, 176, 0.12)',
      border: '#432a54',
      text: '#c499e3',
    },
    // Intelligence / IOC / Enrichment
    intelligence: {
      solid: '#2dd4bf',
      subtle: 'rgba(45, 212, 191, 0.12)',
      border: '#134e4a',
      text: '#2dd4bf',
    },
  },

  // Elevation Shadows
  elevation: {
    level1: '0 4px 12px rgba(0, 0, 0, 0.4)',
    level2: '0 12px 32px rgba(0, 0, 0, 0.6)',
    anomalyGlow: '0 0 16px rgba(201, 162, 39, 0.2)',
  },
} as const;

export type ColorTokens = typeof colors;
