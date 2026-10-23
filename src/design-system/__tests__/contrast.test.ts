import { describe, it, expect } from 'vitest';
import { colors } from '../tokens/colors';

/**
 * WCAG 2.1 Color Contrast Utilities & Tests
 * Formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const fullHex = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.slice(0, 6);

  const num = parseInt(fullHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = getLuminance(hexToRgb(foregroundHex));
  const lum2 = getLuminance(hexToRgb(backgroundHex));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Design Prompt D2 - WCAG AA Contrast Compliance', () => {
  const surfaces = [
    { name: 'surface.page', hex: colors.surface.page },
    { name: 'surface.section', hex: colors.surface.section },
    { name: 'surface.card', hex: colors.surface.card },
    { name: 'surface.raised', hex: colors.surface.raised },
  ];

  describe('Body Text Pairs (Minimum 4.5:1 ratio required)', () => {
    surfaces.forEach((surface) => {
      it(`text.primary (#ede6d8) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.text.primary, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`text.secondary (#b9af9c) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.text.secondary, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`text.muted (#8e8574) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.text.muted, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`semantic.alert.text (#ff8d7d) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.semantic.alert.text, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`semantic.verified.text (#4ade80) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.semantic.verified.text, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`semantic.anomaly.text (#fb923c) on ${surface.name} (${surface.hex}) satisfies WCAG AA (>= 4.5:1)`, () => {
        const ratio = getContrastRatio(colors.semantic.anomaly.text, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('text.inverse (#100e0c) on accent.gold (#c9a227) satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = getContrastRatio(colors.text.inverse, colors.accent.gold);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Large Text, Badges and Icons (Minimum 3:1 ratio required)', () => {
    surfaces.forEach((surface) => {
      it(`accent.gold (#c9a227) on ${surface.name} satisfies Large Text / Icon AA (>= 3:1)`, () => {
        const ratio = getContrastRatio(colors.accent.gold, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });

      it(`semantic.verified.solid (#22c55e) on ${surface.name} satisfies Icon/Badge AA (>= 3:1)`, () => {
        const ratio = getContrastRatio(colors.semantic.verified.solid, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });

      it(`semantic.anomaly.solid (#f97316) on ${surface.name} satisfies Icon/Badge AA (>= 3:1)`, () => {
        const ratio = getContrastRatio(colors.semantic.anomaly.solid, surface.hex);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });
  });
});
