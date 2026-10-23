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
          page: 'var(--surface-page, #100e0c)',
          section: 'var(--surface-section, #14110d)',
          card: 'var(--surface-card, #171410)',
          'card-elevated': 'var(--surface-card-elevated, #1c1813)',
        },
        border: {
          DEFAULT: 'var(--border-default, #3a352c)',
          subtle: 'var(--border-subtle, #26221b)',
          focus: 'var(--border-focus, #c9a227)',
        },
        text: {
          primary: 'var(--text-primary, #ede6d8)',
          muted: 'var(--text-muted, #8a8070)',
          secondary: 'var(--text-secondary, #94a3b8)',
        },
        accent: {
          gold: 'var(--accent-gold, #c9a227)',
          'gold-hover': 'var(--accent-gold-hover, #dec052)',
          'gold-subtle': 'var(--accent-gold-subtle, rgba(201, 162, 39, 0.12))',
          'gold-border': 'var(--accent-gold-border, rgba(201, 162, 39, 0.35))',
        },
        semantic: {
          verified: {
            DEFAULT: 'var(--semantic-verified, #48a975)',
            subtle: 'var(--semantic-verified-subtle, rgba(72, 169, 117, 0.12))',
            border: 'var(--semantic-verified-border, #48a975)',
            text: 'var(--semantic-verified-text, #86efac)',
          },
          anomaly: {
            DEFAULT: 'var(--semantic-anomaly, #c9a227)',
            subtle: 'var(--semantic-anomaly-subtle, rgba(201, 162, 39, 0.12))',
            border: 'var(--semantic-anomaly-border, #c9a227)',
            text: 'var(--semantic-anomaly-text, #fed7aa)',
          },
          alert: {
            DEFAULT: 'var(--semantic-alert, #b23a2e)',
            subtle: 'var(--semantic-alert-subtle, rgba(178, 58, 46, 0.12))',
            border: 'var(--semantic-alert-border, #b23a2e)',
            text: 'var(--semantic-alert-text, #fca5a5)',
          },
          destination: {
            DEFAULT: 'var(--semantic-destination, #8c58b0)',
            subtle: 'var(--semantic-destination-subtle, rgba(140, 88, 176, 0.12))',
            border: 'var(--semantic-destination-border, #8c58b0)',
            text: 'var(--semantic-destination-text, #d8b4fe)',
          },
          intelligence: {
            DEFAULT: 'var(--semantic-intelligence, #319795)',
            subtle: 'var(--semantic-intelligence-subtle, rgba(49, 151, 149, 0.12))',
            border: 'var(--semantic-intelligence-border, #319795)',
            text: 'var(--semantic-intelligence-text, #99f6e4)',
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
