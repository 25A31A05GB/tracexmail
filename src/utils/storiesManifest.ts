import { z } from 'zod';

export type StoryLanguageCode = 'en' | 'hi' | 'te';

export const StoryChapterSchema = z.object({
  title: z.string().min(1),
  time: z.number().min(0)
});

export type StoryChapter = z.infer<typeof StoryChapterSchema>;

export const StoryFeatureSchema = z.object({
  label: z.string().min(1),
  status: z.enum(['in_app', 'concept']),
  description: z.string().optional()
});

export type StoryFeature = z.infer<typeof StoryFeatureSchema>;

export const StoryFilmSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  isOverview: z.boolean().default(false),
  title: z.string().min(1),
  hook: z.string().min(1),
  tags: z.array(z.string()),
  runtime: z.string().min(1),
  durationSeconds: z.number().positive(),
  isoDuration: z.string().regex(/^PT(?:(\d+)M)?(?:(\d+)S)?$/),
  poster: z.string(),
  languages: z.array(z.enum(['en', 'hi', 'te'])).min(1),
  chapters: z.array(StoryChapterSchema),
  features: z.array(StoryFeatureSchema),
  transcripts: z.record(z.enum(['en', 'hi', 'te']), z.string()).optional()
});

export type StoryFilm = z.infer<typeof StoryFilmSchema>;

export const StoriesManifestSchema = z.object({
  version: z.string(),
  statusLegend: z.object({
    in_app: z.object({
      label: z.string(),
      description: z.string()
    }),
    concept: z.object({
      label: z.string(),
      description: z.string()
    })
  }),
  languages: z.array(
    z.object({
      code: z.enum(['en', 'hi', 'te']),
      label: z.string(),
      name: z.string()
    })
  ),
  notice: z.string(),
  overview: StoryFilmSchema,
  stories: z.array(StoryFilmSchema).min(1)
});

export type StoriesManifest = z.infer<typeof StoriesManifestSchema>;

/**
 * Validates raw JSON object against StoriesManifestSchema using Zod.
 * Throws ZodError if invalid.
 */
export function validateStoriesManifest(data: unknown): StoriesManifest {
  return StoriesManifestSchema.parse(data);
}

/**
 * Resolves video asset URL relative to VITE_VIDEO_BASE_URL.
 */
export function resolveVideoAssetUrl(relativePath: string): string {
  const base = (import.meta.env.VITE_VIDEO_BASE_URL || '').replace(/\/+$/, '');
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

/**
 * Resolves standard paths for a story film in a given language.
 */
export function getFilmMediaUrls(film: StoryFilm, lang: StoryLanguageCode) {
  const isOverview = film.isOverview || film.slug === 'overview';
  const folder = isOverview ? '/overview' : `/stories/${film.slug}`;

  return {
    videoUrl: resolveVideoAssetUrl(`${folder}/${lang}.mp4`),
    vttUrl: resolveVideoAssetUrl(`${folder}/${lang}.vtt`),
    posterUrl: resolveVideoAssetUrl(film.poster || `${folder}/poster.jpg`)
  };
}

/**
 * Resolves hero background loop video and poster URLs.
 */
export function getHeroLoopUrls() {
  return {
    videoUrl: resolveVideoAssetUrl('/hero/hero-loop.mp4'),
    posterUrl: resolveVideoAssetUrl('/hero/hero-poster.jpg')
  };
}

/**
 * Determines default language from localStorage ("tx-lang") or navigator.language.
 * Defaults to 'te' if Telugu, 'hi' if Hindi, otherwise 'en'.
 */
export function getDefaultLanguage(storedLang?: string | null, navLanguage?: string): StoryLanguageCode {
  if (storedLang && ['en', 'hi', 'te'].includes(storedLang)) {
    return storedLang as StoryLanguageCode;
  }

  const rawLang = (navLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : '')).toLowerCase();
  if (rawLang.startsWith('te')) return 'te';
  if (rawLang.startsWith('hi')) return 'hi';
  return 'en';
}

/**
 * Returns the active chapter matching the current playback time.
 */
export function getChapterAtTime(chapters: StoryChapter[], timeInSeconds: number): StoryChapter | null {
  if (!chapters || chapters.length === 0) return null;
  // Sort ascending by time
  const sorted = [...chapters].sort((a, b) => a.time - b.time);
  let active: StoryChapter = sorted[0];

  for (const ch of sorted) {
    if (timeInSeconds >= ch.time) {
      active = ch;
    } else {
      break;
    }
  }

  return active;
}

/**
 * Lightweight telemetry event tracker (Console + window.Sentry / Analytics if present).
 */
export type StoryEventName =
  | 'play'
  | 'pause'
  | 'progress_25'
  | 'progress_50'
  | 'progress_75'
  | 'progress_100'
  | 'language_change'
  | 'chapter_seek'
  | 'cta_click';

export function trackStoryEvent(event: StoryEventName, data?: Record<string, any>): void {
  try {
    const payload = {
      event: `story_${event}`,
      timestamp: new Date().toISOString(),
      ...data
    };

    // 1. Local telemetry logging
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[TraceXStoryTelemtry] ${event}:`, payload);
    }

    // 2. Google Analytics dataLayer if available
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push(payload);
    }

    // 3. Sentry breadcrumb if available
    if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
      const Sentry = (window as any).Sentry;
      if (Sentry?.addBreadcrumb) {
        Sentry.addBreadcrumb({
          category: 'story_player',
          message: `Story event: ${event}`,
          data: payload,
          level: 'info'
        });
      }
    }
  } catch {
    // Non-fatal telemetry catch
  }
}

/**
 * Injects or updates Schema.org VideoObject JSON-LD for rich snippet compliance.
 */
export function injectVideoSchemaJsonLd(film: StoryFilm, currentLang: StoryLanguageCode): void {
  if (typeof document === 'undefined') return;

  const scriptId = `jsonld-video-${film.slug}`;
  let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = scriptId;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tracexmail.vercel.app';
  const urls = getFilmMediaUrls(film, currentLang);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: film.title,
    description: film.hook,
    thumbnailUrl: [urls.posterUrl.startsWith('http') ? urls.posterUrl : `${origin}${urls.posterUrl}`],
    uploadDate: '2026-01-01T00:00:00Z',
    duration: film.isoDuration,
    contentUrl: urls.videoUrl.startsWith('http') ? urls.videoUrl : `${origin}${urls.videoUrl}`,
    embedUrl: `${origin}/stories?film=${film.slug}`,
    inLanguage: currentLang,
    hasPart: film.chapters.map((ch, idx) => ({
      '@type': 'Clip',
      name: ch.title,
      startOffset: ch.time,
      endOffset: film.chapters[idx + 1]?.time ?? film.durationSeconds,
      url: `${origin}/stories?film=${film.slug}&t=${ch.time}`
    }))
  };

  scriptEl.textContent = JSON.stringify(jsonLd);
}
