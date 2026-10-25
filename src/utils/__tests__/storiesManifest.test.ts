import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateStoriesManifest,
  getDefaultLanguage,
  getChapterAtTime,
  trackStoryEvent,
  getFilmMediaUrls,
  resolveVideoAssetUrl,
  StoryFilm,
  StoriesManifest
} from '../storiesManifest';

describe('Stories Manifest & Video Utilities Unit Test Suite', () => {
  const sampleValidManifest: StoriesManifest = {
    version: '1.0.0',
    statusLegend: {
      in_app: {
        label: 'In the app',
        description: 'Functional platform capability'
      },
      concept: {
        label: 'Concept',
        description: 'Research concept or simulated scenario'
      }
    },
    languages: [
      { code: 'en', label: 'EN', name: 'English' },
      { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
      { code: 'te', label: 'తెలుగు', name: 'Telugu' }
    ],
    notice: 'Fictional scenario · sample data · AI-generated narration',
    overview: {
      id: 'film_ov_test',
      slug: 'overview',
      isOverview: true,
      title: 'Platform Overview',
      hook: 'Technical breakdown',
      tags: ['Architecture'],
      runtime: '4:12',
      durationSeconds: 252,
      isoDuration: 'PT4M12S',
      poster: '/overview/poster.jpg',
      languages: ['en', 'hi', 'te'],
      chapters: [
        { title: 'Intro', time: 0 },
        { title: 'Deep Hop Analysis', time: 60 }
      ],
      features: [
        { label: 'Header Parsing', status: 'in_app' },
        { label: 'Mesh Defense', status: 'concept' }
      ]
    },
    stories: [
      {
        id: 'film_st_test_1',
        slug: 'ceo-fraud-test',
        isOverview: false,
        title: 'CEO Fraud Test',
        hook: 'Payroll divert attempt',
        tags: ['BEC', 'Wire Fraud'],
        runtime: '3:14',
        durationSeconds: 194,
        isoDuration: 'PT3M14S',
        poster: '/stories/ceo-fraud-test/poster.jpg',
        languages: ['en', 'hi', 'te'],
        chapters: [
          { title: 'Inbound Infiltration', time: 0 },
          { title: 'Hop Anomaly Detection', time: 45 },
          { title: 'Cryptographic Failure', time: 100 }
        ],
        features: [
          { label: 'DKIM Validator', status: 'in_app' },
          { label: 'Automated Wire Freeze', status: 'concept' }
        ],
        transcripts: {
          en: 'Test transcript in English.',
          hi: 'हिंदी में टेस्ट ट्रांसक्रिप्ट।',
          te: 'తెలుగులో టెస్ట్ ట్రాన్స్‌క్రిప్ట్.'
        }
      }
    ]
  };

  describe('1. Zod Manifest Validation', () => {
    it('successfully validates a well-formed manifest', () => {
      const validated = validateStoriesManifest(sampleValidManifest);
      expect(validated.version).toBe('1.0.0');
      expect(validated.stories.length).toBe(1);
      expect(validated.overview.isOverview).toBe(true);
    });

    it('rejects manifest with invalid duration format', () => {
      const invalid = {
        ...sampleValidManifest,
        overview: {
          ...sampleValidManifest.overview,
          isoDuration: 'INVALID_DURATION_STRING'
        }
      };

      expect(() => validateStoriesManifest(invalid)).toThrow();
    });

    it('rejects manifest with negative durationSeconds', () => {
      const invalid = {
        ...sampleValidManifest,
        overview: {
          ...sampleValidManifest.overview,
          durationSeconds: -50
        }
      };

      expect(() => validateStoriesManifest(invalid)).toThrow();
    });

    it('rejects manifest with invalid feature status (neither in_app nor concept)', () => {
      const invalid = {
        ...sampleValidManifest,
        stories: [
          {
            ...sampleValidManifest.stories[0],
            features: [
              {
                label: 'Test Feature',
                status: 'unsupported_status' as any
              }
            ]
          }
        ]
      };

      expect(() => validateStoriesManifest(invalid)).toThrow();
    });

    it('rejects manifest with empty stories list', () => {
      const invalid = {
        ...sampleValidManifest,
        stories: []
      };

      expect(() => validateStoriesManifest(invalid)).toThrow();
    });
  });

  describe('2. Default Language Selection', () => {
    it('returns stored language if valid (te)', () => {
      expect(getDefaultLanguage('te', 'en-US')).toBe('te');
    });

    it('returns stored language if valid (hi)', () => {
      expect(getDefaultLanguage('hi', 'en-US')).toBe('hi');
    });

    it('falls back to navigator language when no stored preference exists', () => {
      expect(getDefaultLanguage(null, 'te-IN')).toBe('te');
      expect(getDefaultLanguage(null, 'hi-IN')).toBe('hi');
      expect(getDefaultLanguage(null, 'en-GB')).toBe('en');
    });

    it('defaults to en when navigator language is unsupported', () => {
      expect(getDefaultLanguage(null, 'fr-FR')).toBe('en');
      expect(getDefaultLanguage(null, 'ja-JP')).toBe('en');
      expect(getDefaultLanguage(null, '')).toBe('en');
    });
  });

  describe('3. Chapter Lookup by Time', () => {
    const testChapters = [
      { title: 'Chapter 1: Genesis', time: 0 },
      { title: 'Chapter 2: Relay Hop', time: 45 },
      { title: 'Chapter 3: Cryptographic Proof', time: 90 },
      { title: 'Chapter 4: Remediation', time: 140 }
    ];

    it('returns first chapter at 0 seconds', () => {
      const ch = getChapterAtTime(testChapters, 0);
      expect(ch?.title).toBe('Chapter 1: Genesis');
    });

    it('returns Chapter 1 before 45 seconds', () => {
      const ch = getChapterAtTime(testChapters, 30);
      expect(ch?.title).toBe('Chapter 1: Genesis');
    });

    it('returns Chapter 2 exactly at 45 seconds', () => {
      const ch = getChapterAtTime(testChapters, 45);
      expect(ch?.title).toBe('Chapter 2: Relay Hop');
    });

    it('returns Chapter 3 between 90 and 139 seconds', () => {
      const ch = getChapterAtTime(testChapters, 115);
      expect(ch?.title).toBe('Chapter 3: Cryptographic Proof');
    });

    it('returns final Chapter for time beyond last chapter start', () => {
      const ch = getChapterAtTime(testChapters, 200);
      expect(ch?.title).toBe('Chapter 4: Remediation');
    });

    it('handles unsorted chapters gracefully', () => {
      const unsorted = [
        { title: 'Late Chapter', time: 120 },
        { title: 'Early Chapter', time: 10 }
      ];
      expect(getChapterAtTime(unsorted, 15)?.title).toBe('Early Chapter');
      expect(getChapterAtTime(unsorted, 130)?.title).toBe('Late Chapter');
    });

    it('returns null for empty chapters array', () => {
      expect(getChapterAtTime([], 50)).toBeNull();
    });
  });

  describe('4. Media URL Resolution', () => {
    it('builds standard story paths for a given language', () => {
      const story = sampleValidManifest.stories[0];
      const urls = getFilmMediaUrls(story, 'hi');

      expect(urls.videoUrl).toBe('/stories/ceo-fraud-test/hi.mp4');
      expect(urls.vttUrl).toBe('/stories/ceo-fraud-test/hi.vtt');
      expect(urls.posterUrl).toBe('/stories/ceo-fraud-test/poster.jpg');
    });

    it('builds overview paths correctly', () => {
      const ov = sampleValidManifest.overview;
      const urls = getFilmMediaUrls(ov, 'te');

      expect(urls.videoUrl).toBe('/overview/te.mp4');
      expect(urls.vttUrl).toBe('/overview/te.vtt');
      expect(urls.posterUrl).toBe('/overview/poster.jpg');
    });
  });

  describe('5. Telemetry Tracking', () => {
    it('dispatches story events without crashing', () => {
      expect(() => {
        trackStoryEvent('play', { film: 'ceo-fraud-test', lang: 'en' });
        trackStoryEvent('progress_50', { film: 'ceo-fraud-test', lang: 'hi' });
        trackStoryEvent('cta_click', { film: 'ceo-fraud-test', cta: 'analyze_own_email' });
      }).not.toThrow();
    });
  });
});
