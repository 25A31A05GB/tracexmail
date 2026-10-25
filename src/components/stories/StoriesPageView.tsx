import React, { useState, useEffect } from 'react';
import {
  Film,
  Play,
  Clock,
  Globe,
  ArrowLeft,
  FileText,
  Search,
  CheckCircle2,
  HelpCircle,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
  Info
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
import { HeroLoop } from './HeroLoop';
import { TraceXLogo } from '../common/TraceXLogo';
import { updatePageMetadata } from '../../utils/seo';

interface StoriesPageViewProps {
  onNavigateHome: () => void;
  onAnalyzeEmail?: () => void;
}

export function StoriesPageView({ onNavigateHome, onAnalyzeEmail }: StoriesPageViewProps) {
  const [manifest, setManifest] = useState<StoriesManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFilm, setSelectedFilm] = useState<StoryFilm | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<StoryLanguageCode>('en');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTag, setActiveTag] = useState<string>('all');
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);

  useEffect(() => {
    updatePageMetadata({
      title: 'Case Files & Forensic Incident Films | TraceXMail',
      description: 'Watch step-by-step reconstructions of BEC wire diversion, Evilginx reverse proxies, and supply chain poisoning with forensic header proofs in English, Hindi, and Telugu.',
      canonicalPath: '/stories'
    });

    const stored = typeof window !== 'undefined' ? localStorage.getItem('tx-lang') : null;
    setSelectedLanguage(getDefaultLanguage(stored));

    fetch('/stories/videos.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const validated = validateStoriesManifest(data);
        setManifest(validated);
        setLoading(false);

        // Check URL params for deep-linked film
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const filmSlug = params.get('film');
          if (filmSlug) {
            const allFilms = [validated.overview, ...validated.stories];
            const matched = allFilms.find((f) => f.slug === filmSlug);
            if (matched) {
              setSelectedFilm(matched);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[StoriesPageView] Failed to load stories manifest:', err);
        setLoading(false);
      });
  }, []);

  const allFilms = manifest ? [manifest.overview, ...manifest.stories] : [];

  const allTags = React.useMemo(() => {
    if (!manifest) return [];
    const set = new Set<string>();
    manifest.stories.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [manifest]);

  const filteredFilms = React.useMemo(() => {
    return allFilms.filter((film) => {
      const matchesSearch =
        searchQuery === '' ||
        film.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        film.hook.toLowerCase().includes(searchQuery.toLowerCase()) ||
        film.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag = activeTag === 'all' || film.tags.includes(activeTag);

      return matchesSearch && matchesTag;
    });
  }, [allFilms, searchQuery, activeTag]);

  return (
    <div className="min-h-screen bg-[#100e0c] text-[#ede6d8] font-sans flex flex-col selection:bg-[#c9a227] selection:text-[#100e0c]">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#14120f]/90 backdrop-blur-md border-b border-[#3a352c] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-mono text-[#8a8070] hover:text-[#ede6d8] transition-colors p-1"
            aria-label="Return to TraceXMail Main Overview"
          >
            <ArrowLeft className="w-4 h-4 text-[#c9a227]" />
            <span className="hidden sm:inline">Return to Main Platform</span>
          </button>
          <div className="h-4 w-px bg-[#3a352c] hidden sm:block" />
          <div className="flex items-center gap-2 cursor-pointer" onClick={onNavigateHome}>
            <TraceXLogo size="xs" />
            <span className="font-mono text-xs tracking-widest text-[#c9a227] uppercase font-semibold">
              CASE FILES
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Language Toggle */}
          <div className="flex items-center p-0.5 bg-[#100e0c] border border-[#3a352c] rounded-[3px]" role="group" aria-label="Audio Language">
            {(['en', 'hi', 'te'] as StoryLanguageCode[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  setSelectedLanguage(lang);
                  try {
                    localStorage.setItem('tx-lang', lang);
                  } catch {}
                }}
                className={`px-2 py-1 text-xs font-mono tracking-wider transition-colors rounded-[2px] ${
                  selectedLanguage === lang
                    ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                    : 'text-[#8a8070] hover:text-[#ede6d8]'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिन्दी' : 'తెలుగు'}
              </button>
            ))}
          </div>

          {onAnalyzeEmail && (
            <button
              type="button"
              onClick={onAnalyzeEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold tracking-wider uppercase bg-[#c9a227] text-[#14120f] hover:bg-[#dec052] rounded-[3px] transition-all"
            >
              Analyze Email
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Hero Header with Background Loop */}
      <section className="relative w-full py-16 sm:py-24 px-4 sm:px-8 border-b border-[#3a352c] overflow-hidden bg-[#14110d]">
        <HeroLoop className="absolute inset-0 w-full h-full opacity-35" />

        <div className="relative z-10 max-w-5xl mx-auto space-y-4 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1a1712] border border-[#3a352c] rounded-[3px] text-xs font-mono text-[#c9a227]">
            <Film className="w-3.5 h-3.5" />
            <span>AUTHENTIC INVESTIGATION RECONSTRUCTIONS · 5 CASE STUDIES + 1 OVERVIEW</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-[#ede6d8] tracking-tight">
            Forensic Case Files & Incident Films
          </h1>

          <p className="text-sm sm:text-base text-[#8a8070] font-sans max-w-3xl leading-relaxed">
            Every attack is documented through RFC 822 envelope headers, DNS MX records, and intermediate BGP Autonomous System relays.
            Select a film below to inspect the attack mechanics and compare what capabilities exist live in TraceXMail versus research concepts.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#8a8070]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#68d391]" />
              In the app: Deterministic forensic proofs
            </span>
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#dec052]" />
              Concept: Research & narrative scenario simulations
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-[#14110d] border border-[#3a352c] rounded-[3px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8a8070] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search films by title, attack type, or adversary..."
              className="w-full pl-9 pr-4 py-2 bg-[#100e0c] border border-[#3a352c] focus:border-[#c9a227] rounded-[3px] text-xs font-mono text-[#ede6d8] placeholder:text-[#574f42] outline-none"
            />
          </div>

          {/* Tags bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTag('all')}
              className={`px-2.5 py-1 text-xs font-mono rounded-[2px] transition-colors ${
                activeTag === 'all'
                  ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                  : 'bg-[#1a1712] text-[#8a8070] border border-[#3a352c] hover:text-[#ede6d8]'
              }`}
            >
              All Films
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`px-2 py-1 text-xs font-mono rounded-[2px] whitespace-nowrap transition-colors ${
                  activeTag === tag
                    ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                    : 'bg-[#1a1712] text-[#8a8070] border border-[#3a352c] hover:text-[#ede6d8]'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Films Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFilms.map((film) => {
            const urls = getFilmMediaUrls(film, selectedLanguage);
            const isTranscriptOpen = expandedTranscriptId === film.id;
            return (
              <div
                key={film.id}
                className="bg-[#171410] border border-[#3a352c] hover:border-[#c9a227]/50 rounded-[3px] overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-lg"
              >
                {/* Media Preview Header */}
                <div
                  onClick={() => setSelectedFilm(film)}
                  className="relative aspect-video bg-[#0b0a08] cursor-pointer overflow-hidden flex items-center justify-center group"
                >
                  {/* Forensic Backdrop Graphic */}
                  <div className="absolute inset-0 bg-[#0f0d0a] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#c9a227_1px,transparent_1px)] [background-size:16px_16px]" />
                    <Shield className="w-12 h-12 text-[#c9a227]/30 mb-2 group-hover:scale-110 group-hover:text-[#c9a227]/50 transition-all duration-300" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a8070] mb-1">
                      {film.isOverview ? 'ARCHITECTURE RECONSTRUCTION' : 'FORENSIC INCIDENT FILM'}
                    </span>
                    <span className="text-sm font-serif text-[#ede6d8]/90 max-w-xs line-clamp-1">
                      {film.title}
                    </span>
                  </div>

                  <img
                    src={urls.posterUrl}
                    alt={film.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500 z-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#100e0c] via-transparent to-transparent opacity-80 z-[1]" />

                  {/* Play Overlay */}
                  <div className="absolute z-10 w-12 h-12 rounded-full bg-[#100e0c]/85 border-2 border-[#c9a227] text-[#c9a227] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#c9a227] group-hover:text-[#100e0c] transition-all shadow-[0_0_20px_rgba(201,162,39,0.25)]">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>

                  <div className="absolute top-3 left-3 z-10 px-2 py-0.5 bg-[#100e0c]/85 border border-[#3a352c] rounded-[2px] text-[9px] font-mono text-[#8a8070]">
                    Fictional scenario · sample data
                  </div>

                  <div className="absolute bottom-3 right-3 z-10 px-2 py-0.5 bg-[#100e0c]/90 border border-[#3a352c] rounded-[2px] text-[10px] font-mono text-[#ede6d8] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#c9a227]" />
                    {film.runtime}
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {film.isOverview ? (
                        <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase bg-[#28241c] text-[#c9a227] border border-[#c9a227]/30 rounded-[2px]">
                          PLATFORM OVERVIEW
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase bg-[#1f1d19] text-[#b9af9c] border border-[#3a352c] rounded-[2px]">
                          INCIDENT DOSSIER
                        </span>
                      )}
                      <span className="text-xs font-mono text-[#8a8070]">
                        {film.durationSeconds}s
                      </span>
                    </div>

                    <h3
                      onClick={() => setSelectedFilm(film)}
                      className="text-lg font-serif text-[#ede6d8] hover:text-[#c9a227] cursor-pointer transition-colors leading-snug"
                    >
                      {film.title}
                    </h3>

                    <p className="text-xs text-[#8a8070] font-sans leading-relaxed">
                      {film.hook}
                    </p>

                    {/* Chapters breakdown */}
                    <div className="pt-1">
                      <span className="text-[10px] font-mono uppercase text-[#8a8070] block mb-1.5">
                        Key Timestamps:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {film.chapters.map((ch, idx) => (
                          <button
                            key={`${ch.time}-${idx}`}
                            type="button"
                            onClick={() => setSelectedFilm(film)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-[#14120f] border border-[#2b251d] text-[#b9af9c] hover:border-[#c9a227] rounded-[2px] transition-colors"
                          >
                            {ch.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* What TraceXMail Did Chips */}
                    <div className="pt-2">
                      <span className="text-[10px] font-mono uppercase text-[#8a8070] block mb-1.5">
                        Features In Play:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {film.features.slice(0, 4).map((feat, idx) => (
                          <div
                            key={`${feat.label}-${idx}`}
                            className="px-2 py-1 text-[10px] font-mono bg-[#100e0c] border border-[#2b251d] rounded-[2px] flex items-center justify-between gap-1"
                          >
                            <span className="truncate text-[#ede6d8]">{feat.label}</span>
                            {feat.status === 'in_app' ? (
                              <span className="shrink-0 text-[8px] uppercase tracking-wider text-[#68d391]">
                                In App
                              </span>
                            ) : (
                              <span className="shrink-0 text-[8px] uppercase tracking-wider text-[#dec052]">
                                Concept
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Transcript Drawer Toggle */}
                  <div className="pt-4 border-t border-[#3a352c] space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTranscriptId(isTranscriptOpen ? null : film.id)
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8a8070] hover:text-[#c9a227] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{isTranscriptOpen ? 'Hide Transcript' : 'Read Full Transcript'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedFilm(film)}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold tracking-wider uppercase text-[#c9a227] hover:text-[#dec052]"
                      >
                        Launch Player
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Expandable Transcript Box */}
                    {isTranscriptOpen && film.transcripts?.[selectedLanguage] && (
                      <div className="p-3 bg-[#100e0c] border border-[#3a352c] rounded-[3px] text-xs font-sans text-[#b9af9c] leading-relaxed animate-in fade-in duration-200">
                        <div className="text-[10px] font-mono uppercase text-[#8a8070] mb-1">
                          Transcript ({selectedLanguage.toUpperCase()}):
                        </div>
                        {film.transcripts[selectedLanguage]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="border-t border-[#3a352c] py-8 px-4 text-center text-xs font-mono text-[#8a8070] bg-[#14120f]">
        TraceXMail Forensic Case Files · Fictional scenario · sample data · AI-generated narration · Deterministic Header Deconstruction
      </footer>

      {/* Theatre Modal Dialog */}
      {selectedFilm && manifest && (
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
    </div>
  );
}
