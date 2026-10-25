import React, { useState, useEffect } from 'react';
import {
  Film,
  Play,
  Clock,
  Globe,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  StoriesManifest,
  StoryFilm,
  StoryLanguageCode,
  validateStoriesManifest,
  getDefaultLanguage,
  getFilmMediaUrls
} from '../../utils/storiesManifest';
import { TheatrePlayer } from './TheatrePlayer';

interface CaseFilesSectionProps {
  onAnalyzeEmail?: () => void;
  onViewAllStories?: () => void;
}

export function CaseFilesSection({ onAnalyzeEmail, onViewAllStories }: CaseFilesSectionProps) {
  const [manifest, setManifest] = useState<StoriesManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFilm, setSelectedFilm] = useState<StoryFilm | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<StoryLanguageCode>('en');

  // Load manifest and preferred language
  useEffect(() => {
    let isMounted = true;
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tx-lang') : null;
    setSelectedLanguage(getDefaultLanguage(stored));

    fetch('/stories/videos.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const validated = validateStoriesManifest(data);
        setManifest(validated);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[CaseFilesSection] Could not load stories manifest:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenFilm = (film: StoryFilm, initialLang?: StoryLanguageCode) => {
    if (initialLang) {
      setSelectedLanguage(initialLang);
      try {
        localStorage.setItem('tx-lang', initialLang);
      } catch {}
    }
    setSelectedFilm(film);
  };

  if (loading) {
    return (
      <section className="w-full py-16 px-4 bg-[#14110d] border-t border-[#3a352c]/50">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[220px]">
          <div className="w-6 h-6 border-2 border-[#c9a227] border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs font-mono uppercase tracking-widest text-[#8a8070]">
            Indexing Forensic Case Files & Overview Films...
          </span>
        </div>
      </section>
    );
  }

  if (!manifest) return null;

  return (
    <section id="case-files" className="w-full py-20 px-4 sm:px-6 md:px-8 bg-[#14110d] border-t border-[#3a352c] text-[#ede6d8]">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#3a352c] pb-8">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#1a1712] border border-[#3a352c] rounded-[3px] text-xs font-mono text-[#c9a227]">
              <Film className="w-3.5 h-3.5" />
              <span>FORENSIC DOSSIER FILMS · MULTILINGUAL INCIDENT BREAKDOWNS</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#ede6d8] tracking-tight">
              Case Files: Deconstructing Attacks to the Source
            </h2>

            <p className="text-sm md:text-base text-[#8a8070] font-sans leading-relaxed">
              Explore short-form forensic incident reconstructions showing how TraceXMail follows lookalike domains,
              bulletproof relay hops, and reverse proxies back to threat actor infrastructure. Available with native AI-assisted narration in English, Hindi, and Telugu.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {onViewAllStories && (
              <button
                type="button"
                onClick={onViewAllStories}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[#ede6d8] bg-[#171410] border border-[#3a352c] hover:border-[#c9a227] rounded-[3px] transition-colors"
              >
                Browse All Case Transcripts
                <ChevronRight className="w-4 h-4 text-[#c9a227]" />
              </button>
            )}
          </div>
        </div>

        {/* Featured Overview Dossier Film */}
        {manifest.overview && (
          <div className="relative group bg-[#171410] border border-[#3a352c] hover:border-[#c9a227]/50 rounded-[3px] overflow-hidden transition-all duration-300 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              {/* Media Preview Column */}
              <div
                onClick={() => handleOpenFilm(manifest.overview)}
                className="lg:col-span-7 relative aspect-video bg-[#0b0a08] cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <img
                  src={getFilmMediaUrls(manifest.overview, selectedLanguage).posterUrl}
                  alt={manifest.overview.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                  onError={(e) => {
                    // Fallback to high-contrast dark placeholder
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#100e0c] via-transparent to-transparent opacity-80" />

                {/* Big Center Play Pill */}
                <div className="absolute z-10 flex items-center gap-2.5 px-4 py-2 rounded-[3px] bg-[#100e0c]/90 border border-[#c9a227] text-[#c9a227] group-hover:bg-[#c9a227] group-hover:text-[#100e0c] transition-all shadow-[0_4px_20px_rgba(201,162,39,0.3)]">
                  <Play className="w-4 h-4 fill-current" />
                  <span className="text-xs font-mono font-semibold tracking-wider uppercase">Watch Overview Film</span>
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-3 right-3 z-10 px-2 py-1 bg-[#100e0c]/90 border border-[#3a352c] rounded-[2px] text-[10px] font-mono text-[#ede6d8] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#c9a227]" />
                  {manifest.overview.runtime}
                </div>

                {/* Mandatory Disclaimer Stamp */}
                <div className="absolute top-3 left-3 z-10 px-2 py-0.5 bg-[#100e0c]/85 border border-[#3a352c] rounded-[2px] text-[9px] font-mono text-[#8a8070]">
                  Fictional scenario · sample data
                </div>
              </div>

              {/* Dossier Content Column */}
              <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between space-y-6 bg-[#16130f]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest bg-[#28241c] text-[#c9a227] border border-[#c9a227]/30 rounded-[2px]">
                      CORE ARCHITECTURE FILM
                    </span>
                    <span className="text-xs font-mono text-[#8a8070]">
                      {manifest.overview.durationSeconds}s
                    </span>
                  </div>

                  <h3
                    onClick={() => handleOpenFilm(manifest.overview)}
                    className="text-xl md:text-2xl font-serif text-[#ede6d8] font-normal hover:text-[#c9a227] cursor-pointer transition-colors leading-snug"
                  >
                    {manifest.overview.title}
                  </h3>

                  <p className="text-xs md:text-sm text-[#8a8070] font-sans leading-relaxed">
                    {manifest.overview.hook}
                  </p>

                  {/* Chapter Preview */}
                  <div className="pt-2 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a8070] block">
                      Chapters:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {manifest.overview.chapters.map((ch, idx) => (
                        <span
                          key={`${ch.time}-${idx}`}
                          className="px-2 py-0.5 text-[10px] font-mono bg-[#1a1712] border border-[#2b251d] text-[#b9af9c] rounded-[2px]"
                        >
                          {ch.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#3a352c] flex items-center justify-between gap-4">
                  {/* Language Selector Chips */}
                  <div className="flex items-center gap-1.5" role="group" aria-label="Available Languages">
                    {manifest.languages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleOpenFilm(manifest.overview, lang.code)}
                        className={`px-2 py-1 text-xs font-mono tracking-wider transition-colors border rounded-[2px] ${
                          selectedLanguage === lang.code
                            ? 'bg-[#c9a227] text-[#14120f] border-[#c9a227] font-semibold'
                            : 'bg-[#100e0c] text-[#8a8070] border-[#3a352c] hover:border-[#574f42] hover:text-[#ede6d8]'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenFilm(manifest.overview)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold tracking-wider uppercase text-[#c9a227] hover:text-[#dec052]"
                  >
                    Watch Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5 Short Story Films Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#8a8070] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
              Five Threat Actor Dossiers (English, Hindi & Telugu)
            </h3>
            <span className="text-[11px] font-mono text-[#8a8070]">
              5 Incidents
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manifest.stories.map((story) => (
              <div
                key={story.id}
                className="group flex flex-col bg-[#171410] border border-[#3a352c] hover:border-[#c9a227]/50 rounded-[3px] overflow-hidden transition-all duration-300 shadow-md"
              >
                {/* Poster & Play Trigger */}
                <div
                  onClick={() => handleOpenFilm(story)}
                  className="relative aspect-video bg-[#0b0a08] cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={getFilmMediaUrls(story, selectedLanguage).posterUrl}
                    alt={story.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#100e0c] via-transparent to-transparent opacity-80" />

                  {/* Play Button Overlay */}
                  <div className="absolute z-10 w-11 h-11 rounded-full bg-[#100e0c]/85 border border-[#c9a227] text-[#c9a227] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#c9a227] group-hover:text-[#100e0c] transition-all">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>

                  {/* Runtime */}
                  <div className="absolute bottom-2.5 right-2.5 z-10 px-1.5 py-0.5 bg-[#100e0c]/90 border border-[#3a352c] rounded-[2px] text-[10px] font-mono text-[#ede6d8] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-[#c9a227]" />
                    {story.runtime}
                  </div>

                  {/* Mandatory Stamp */}
                  <div className="absolute top-2.5 left-2.5 z-10 px-1.5 py-0.5 bg-[#100e0c]/85 border border-[#3a352c] rounded-[2px] text-[9px] font-mono text-[#8a8070]">
                    Fictional scenario · sample data
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {story.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[9px] font-mono text-[#8a8070] bg-[#100e0c] border border-[#2b251d] rounded-[2px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <h4
                      onClick={() => handleOpenFilm(story)}
                      className="text-base font-serif text-[#ede6d8] font-medium hover:text-[#c9a227] cursor-pointer transition-colors line-clamp-2"
                    >
                      {story.title}
                    </h4>

                    <p className="text-xs text-[#8a8070] font-sans line-clamp-2 leading-relaxed">
                      {story.hook}
                    </p>
                  </div>

                  {/* Bottom Bar: Language Chips & Play Action */}
                  <div className="pt-3 border-t border-[#3a352c] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1" role="group" aria-label="Play Language">
                      {manifest.languages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleOpenFilm(story, lang.code)}
                          className={`px-1.5 py-0.5 text-[10px] font-mono tracking-wider transition-colors border rounded-[2px] ${
                            selectedLanguage === lang.code
                              ? 'bg-[#c9a227] text-[#14120f] border-[#c9a227] font-semibold'
                              : 'bg-[#100e0c] text-[#8a8070] border-[#3a352c] hover:border-[#574f42] hover:text-[#ede6d8]'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenFilm(story)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#c9a227] hover:text-[#dec052]"
                    >
                      Inspect Case
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Theatre Modal Dialog */}
      {selectedFilm && (
        <TheatrePlayer
          film={selectedFilm}
          isOpen={Boolean(selectedFilm)}
          onClose={() => setSelectedFilm(null)}
          onAnalyzeEmail={onAnalyzeEmail}
          statusLegend={manifest.statusLegend}
          initialLanguage={selectedLanguage}
          onLanguageChange={(lang) => setSelectedLanguage(lang)}
        />
      )}
    </section>
  );
}
