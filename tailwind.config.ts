import type { Config } from 'tailwindcss';
import { colorTokens } from './src/design-system/tokens/colors';
import { fontFamilies, fontSizes } from './src/design-system/tokens/typography';
import { spacingTokens } from './src/design-system/tokens/spacing';
import { radiiTokens, elevationTokens } from './src/design-system/tokens/radii';
import { motionTokens } from './src/design-system/tokens/motion';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          page: 'var(--color-surface-page, #100e0c)',
          section: 'var(--color-surface-section, #14110d)',
          card: 'var(--color-surface-card, #171410)',
          raised: 'var(--color-surface-raised, #1d1a15)',
          'card-elevated': 'var(--color-surface-raised, #1d1a15)',
        },
        border: {
          DEFAULT: 'var(--color-border, #3a352c)',
          subtle: 'var(--color-border-subtle, rgba(58, 53, 44, 0.5))',
          focus: 'var(--color-border-focus, #c9a227)',
        },
        text: {
          primary: 'var(--color-text-primary, #ede6d8)',
          secondary: 'var(--color-text-secondary, #b9af9c)',
          muted: 'var(--color-text-muted, #8e8574)',
          inverse: 'var(--color-text-inverse, #100e0c)',
        },
        accent: {
          gold: 'var(--color-accent-gold, #c9a227)',
          'gold-hover': 'var(--color-accent-gold-hover, #d8b035)',
          'gold-subtle': 'var(--color-accent-gold-muted, rgba(201, 162, 39, 0.12))',
          'gold-border': 'var(--color-accent-gold-border, #5e4710)',
        },
        semantic: {
          verified: {
            DEFAULT: 'var(--color-semantic-verified, #22c55e)',
            deep: 'var(--color-semantic-verified-deep, #2e7a4a)',
            subtle: 'var(--color-semantic-verified-subtle, rgba(34, 197, 94, 0.12))',
            border: 'var(--color-semantic-verified-border, #2e7a4a)',
            text: 'var(--color-semantic-verified-text, #4ade80)',
          },
          anomaly: {
            DEFAULT: 'var(--color-semantic-anomaly, #fb923c)',
            solid: 'var(--color-semantic-anomaly-solid, #f97316)',
            subtle: 'var(--color-semantic-anomaly-subtle, rgba(249, 115, 22, 0.12))',
            border: 'var(--color-semantic-anomaly-border, #9a3412)',
            text: 'var(--color-semantic-anomaly-text, #fb923c)',
          },
          alert: {
            DEFAULT: 'var(--color-semantic-alert, #b23a2e)',
            hover: 'var(--color-semantic-alert-hover, #c94a3d)',
            subtle: 'var(--color-semantic-alert-subtle, rgba(178, 58, 46, 0.12))',
            border: 'var(--color-semantic-alert-border, #b23a2e)',
            text: 'var(--color-semantic-alert-text, #ff8d7d)',
          },
          info: {
            DEFAULT: 'var(--color-semantic-info, #b9af9c)',
            subtle: 'var(--color-semantic-info-subtle, rgba(185, 175, 156, 0.12))',
            border: 'var(--color-semantic-info-border, #3a352c)',
            text: 'var(--color-semantic-info-text, #b9af9c)',
          },
        },
      },
      fontFamily: {
        heading: [
          '"Source Serif 4"',
          '"Noto Serif"',
          '"Noto Serif Devanagari"',
          '"Noto Serif Arabic"',
          '"Noto Serif CJK SC"',
          '"Noto Serif CJK JP"',
          'Georgia',
          'serif',
        ],
        body: [
          '"IBM Plex Sans"',
          '"Inter"',
          '"Noto Sans"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Arabic"',
          '"Noto Sans CJK SC"',
          '"Noto Sans CJK JP"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          '"Noto Sans Mono"',
          'ui-monospace',
          'monospace',
        ],
      },
      fontSize: {
        '12': ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        '14': ['14px', { lineHeight: '20px', letterSpacing: '0' }],
        '16': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        '20': ['20px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        '28': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        '40': ['40px', { lineHeight: '48px', letterSpacing: '-0.025em' }],
      },
      spacing: spacingTokens,
      borderRadius: radiiTokens,
      boxShadow: {
        elevation1: elevationTokens.level1,
        elevation2: elevationTokens.level2,
      },
      transitionDuration: {
        fast: motionTokens.duration.fast,
        base: motionTokens.duration.base,
        slow: motionTokens.duration.slow,
      },
      transitionTimingFunction: {
        DEFAULT: motionTokens.easing.default,
      },
    },
  },
  plugins: [],
};

export default config;
