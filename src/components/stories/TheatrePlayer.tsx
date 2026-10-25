import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Subtitles,
  Maximize,
  RotateCcw,
  Sparkles,
  Shield,
  Info,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Clock,
  Layers,
  AlertTriangle,
  FastForward,
  Rewind,
  Sliders,
  Tv
} from 'lucide-react';
import {
  StoryFilm,
  StoryLanguageCode,
  StoryChapter,
  getFilmMediaUrls,
  getChapterAtTime,
  trackStoryEvent,
  injectVideoSchemaJsonLd
} from '../../utils/storiesManifest';
import { ForensicMotionVisualizer } from './ForensicMotionVisualizer';
import { forensicAudio } from '../../utils/forensicAudio';
import { parseVttContent, getActiveCue, VttCue } from '../../utils/vttParser';

interface TheatrePlayerProps {
  film: StoryFilm;
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeEmail?: () => void;
  statusLegend: {
    in_app: { label: string; description: string };
    concept: { label: string; description: string };
  };
  initialLanguage?: StoryLanguageCode;
  onLanguageChange?: (lang: StoryLanguageCode) => void;
}

export function TheatrePlayer({
  film,
  isOpen,
  onClose,
  onAnalyzeEmail,
  statusLegend,
  initialLanguage = 'en',
  onLanguageChange
}: TheatrePlayerProps) {
  const [currentLang, setCurrentLang] = useState<StoryLanguageCode>(initialLanguage);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(film.durationSeconds || 1);
  const [activeChapter, setActiveChapter] = useState<StoryChapter | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(true);
  const [showLegendModal, setShowLegendModal] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);

  const [cues, setCues] = useState<VttCue[]>([]);
  const [activeCue, setActiveCue] = useState<VttCue | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTrackedRef = useRef<{ 25: boolean; 50: boolean; 75: boolean; 100: boolean }>({
    25: false,
    50: false,
    75: false,
    100: false
  });
  const lastTimeRef = useRef<number>(performance.now());
  const prevChapterTitleRef = useRef<string | null>(null);

  // Sync state if initialLanguage changes
  useEffect(() => {
    setCurrentLang(initialLanguage);
  }, [initialLanguage]);

  // Set duration when film changes
  useEffect(() => {
    setDuration(film.durationSeconds || 240);
    setCurrentTime(0);
    setIsPlaying(false);
    forensicAudio.cancelSpeech();
    forensicAudio.stopAmbient();
  }, [film.id]);

  // Inject schema.org VideoObject JSON-LD
  useEffect(() => {
    if (isOpen && film) {
      injectVideoSchemaJsonLd(film, currentLang);
    }
  }, [isOpen, film, currentLang]);

  // Reset tracking when film or lang changes
  useEffect(() => {
    progressTrackedRef.current = { 25: false, 50: false, 75: false, 100: false };
  }, [film.id, currentLang]);

  const { videoUrl, vttUrl, posterUrl } = getFilmMediaUrls(film, currentLang);

  // Load and parse VTT subtitles file
  useEffect(() => {
    let isCancelled = false;

    fetch(vttUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`VTT HTTP ${res.status}`);
        return res.text();
      })
      .then((vttText) => {
        if (!isCancelled) {
          const parsed = parseVttContent(vttText);
          setCues(parsed);
        }
      })
      .catch(() => {
        // Fallback: generate cues from chapters & narrative transcript if VTT fails to load
        if (!isCancelled) {
          const fallbackCues: VttCue[] = [];
          const chs = film.chapters || [];
          const trans = film.transcripts?.[currentLang] || film.hook;
          const sentences = trans.split(/(?<=[.!?])\s+/);

          chs.forEach((ch, idx) => {
            const start = ch.time;
            const end = idx < chs.length - 1 ? chs[idx + 1].time : (film.durationSeconds || 240);
            const sentence = sentences[idx % sentences.length] || ch.title;
            fallbackCues.push({
              start,
              end,
              text: sentence
            });
          });

          setCues(fallbackCues);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [vttUrl, currentLang, film]);

  // Clock progression for Simulation Video Player
  useEffect(() => {
    if (!isPlaying || !isSimulationMode) return;

    lastTimeRef.current = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = ((now - lastTimeRef.current) / 1000) * playbackSpeed;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + deltaSec;
        if (next >= duration) {
          setIsPlaying(false);
          forensicAudio.stopAmbient();
          forensicAudio.cancelSpeech();
          return duration;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, isSimulationMode, playbackSpeed, duration]);

  // Synchronize active cue & active chapter with currentTime
  useEffect(() => {
    const cue = getActiveCue(cues, currentTime);
    setActiveCue(cue);

    // Speak cue via speech synthesis when cue triggers and user is playing
    if (cue && isPlaying && !isMuted) {
      forensicAudio.speakCue(cue.text, currentLang);
    }

    // Update active chapter & play telemetry chirp on chapter switch
    const ch = getChapterAtTime(film.chapters, currentTime);
    if (ch && ch.title !== prevChapterTitleRef.current) {
      prevChapterTitleRef.current = ch.title;
      setActiveChapter(ch);
      if (isPlaying && !isMuted) {
        forensicAudio.playTelemetryChirp(780);
      }
    }

    // Telemetry progress milestones (25, 50, 75, 100)
    const ratio = duration > 0 ? currentTime / duration : 0;
    if (ratio >= 0.25 && !progressTrackedRef.current[25]) {
      progressTrackedRef.current[25] = true;
      trackStoryEvent('progress_25', { film: film.slug, lang: currentLang });
    }
    if (ratio >= 0.5 && !progressTrackedRef.current[50]) {
      progressTrackedRef.current[50] = true;
      trackStoryEvent('progress_50', { film: film.slug, lang: currentLang });
    }
    if (ratio >= 0.75 && !progressTrackedRef.current[75]) {
      progressTrackedRef.current[75] = true;
      trackStoryEvent('progress_75', { film: film.slug, lang: currentLang });
    }
    if (ratio >= 0.99 && !progressTrackedRef.current[100]) {
      progressTrackedRef.current[100] = true;
      trackStoryEvent('progress_100', { film: film.slug, lang: currentLang });
    }
  }, [currentTime, cues, isPlaying, isMuted, currentLang, duration, film]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';
      if (isInput) return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleCaptions();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isPlaying, isMuted, showCaptions, currentTime]);

  const handleClose = () => {
    setIsPlaying(false);
    forensicAudio.cancelSpeech();
    forensicAudio.stopAmbient();
    onClose();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      forensicAudio.pauseSpeech();
      videoRef.current?.pause();
      trackStoryEvent('pause', { film: film.slug, lang: currentLang, time: currentTime });
    } else {
      forensicAudio.init();
      forensicAudio.setVolume(volume);
      forensicAudio.setPlaybackRate(playbackSpeed);
      if (!isMuted) {
        forensicAudio.startAmbient();
      }

      // If at end, wrap around to 0
      if (currentTime >= duration) {
        setCurrentTime(0);
      }

      setIsPlaying(true);
      lastTimeRef.current = performance.now();

      if (activeCue && !isMuted) {
        forensicAudio.speakCue(activeCue.text, currentLang);
      }

      videoRef.current?.play().catch(() => {
        // Fall back to simulation mode if real video cannot decode
        setIsSimulationMode(true);
      });

      trackStoryEvent('play', { film: film.slug, lang: currentLang, time: currentTime });
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    handleSeek(currentTime + deltaSeconds);
  };

  const handleSeek = (timeSeconds: number) => {
    const clamped = Math.max(0, Math.min(duration || film.durationSeconds, timeSeconds));
    setCurrentTime(clamped);
    forensicAudio.cancelSpeech();

    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }

    if (isPlaying && !isMuted) {
      const cue = getActiveCue(cues, clamped);
      if (cue) {
        forensicAudio.speakCue(cue.text, currentLang);
      }
    }

    trackStoryEvent('chapter_seek', { film: film.slug, targetTime: clamped, lang: currentLang });
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    forensicAudio.setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const toggleCaptions = () => {
    setShowCaptions(!showCaptions);
  };

  const toggleFullscreen = () => {
    const container = dialogRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleLanguageSwitch = (newLang: StoryLanguageCode) => {
    if (newLang === currentLang) return;

    forensicAudio.cancelSpeech();
    setCurrentLang(newLang);
    onLanguageChange?.(newLang);

    try {
      localStorage.setItem('tx-lang', newLang);
    } catch {}

    trackStoryEvent('language_change', {
      film: film.slug,
      fromLang: currentLang,
      toLang: newLang,
      time: currentTime
    });
  };

  const handleSpeedSelect = (spd: number) => {
    setPlaybackSpeed(spd);
    forensicAudio.setPlaybackRate(spd);
    if (videoRef.current) {
      videoRef.current.playbackRate = spd;
    }
    setShowSpeedMenu(false);
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Forensic Case Film: ${film.title}`}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#000000]/90 backdrop-blur-md outline-none animate-in fade-in duration-200"
    >
      {/* Dossier Theatre Frame */}
      <div className="relative w-full max-w-5xl max-h-[96vh] flex flex-col bg-[#14120f] border border-[#3a352c] rounded-[3px] shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden text-[#ede6d8]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#171410] border-b border-[#3a352c]">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest uppercase bg-[#28241c] text-[#c9a227] border border-[#c9a227]/30 rounded-[3px] flex items-center gap-1.5">
              <Tv className="w-3 h-3 text-[#c9a227]" />
              {film.isOverview ? 'OVERVIEW DOSSIER' : 'CASE FILM'}
            </span>
            <h2 className="text-sm md:text-base font-serif text-[#ede6d8] truncate font-medium">
              {film.title}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Language Switcher Chips */}
            <div
              className="flex items-center p-0.5 bg-[#100e0c] border border-[#3a352c] rounded-[3px]"
              role="group"
              aria-label="Audio & Subtitles Language"
            >
              <button
                type="button"
                onClick={() => handleLanguageSwitch('en')}
                aria-pressed={currentLang === 'en'}
                className={`px-2 py-1 text-xs font-mono tracking-wider transition-colors rounded-[2px] ${
                  currentLang === 'en'
                    ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                    : 'text-[#8a8070] hover:text-[#ede6d8]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSwitch('hi')}
                aria-pressed={currentLang === 'hi'}
                className={`px-2 py-1 text-xs font-mono tracking-wider transition-colors rounded-[2px] ${
                  currentLang === 'hi'
                    ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                    : 'text-[#8a8070] hover:text-[#ede6d8]'
                }`}
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSwitch('te')}
                aria-pressed={currentLang === 'te'}
                className={`px-2 py-1 text-xs font-mono tracking-wider transition-colors rounded-[2px] ${
                  currentLang === 'te'
                    ? 'bg-[#c9a227] text-[#14120f] font-semibold'
                    : 'text-[#8a8070] hover:text-[#ede6d8]'
                }`}
              >
                తెలుగు
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close Case Film Player"
              className="p-1.5 text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#221e17] rounded-[3px] transition-colors border border-transparent hover:border-[#3a352c]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container (Forensic Motion Cinema) */}
        <div className="relative w-full aspect-video bg-[#0b0a08] flex items-center justify-center overflow-hidden group">
          {/* Active 60 FPS Forensic Motion Visualizer */}
          <ForensicMotionVisualizer
            film={film}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            activeChapter={activeChapter}
            activeCue={showCaptions ? activeCue : null}
            currentLang={currentLang}
            onSeek={handleSeek}
          />

          {/* Hidden Background Video tag if real MP4 is available */}
          {!isSimulationMode && (
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              preload="none"
              muted={isMuted}
              onError={() => setIsSimulationMode(true)}
              className="hidden"
            />
          )}

          {/* Big Center Play Button when paused */}
          {!isPlaying && (
            <button
              type="button"
              onClick={togglePlayPause}
              aria-label="Play Case Film"
              className="absolute z-30 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#100e0c]/85 border-2 border-[#c9a227] text-[#c9a227] flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_35px_rgba(201,162,39,0.35)] hover:bg-[#171410]"
            >
              <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1.5 fill-current" />
            </button>
          )}

          {/* Mandatory Forensic Notice Watermark */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none px-2 py-1 bg-[#100e0c]/85 border border-[#3a352c] rounded-[3px] text-[10px] font-mono text-[#8a8070] tracking-wide">
            Fictional scenario · sample data · AI-narrated reconstruction
          </div>

          {/* Bottom Video Controls Bar */}
          <div className="absolute bottom-0 inset-x-0 z-30 px-4 py-2.5 bg-gradient-to-t from-[#100e0c] via-[#100e0c]/90 to-transparent flex flex-col gap-2">
            {/* Scrubber / Progress Bar with Chapter Markers */}
            <div
              className="relative w-full h-2 bg-[#28241c] rounded-[2px] cursor-pointer group/bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                handleSeek(pos * (duration || film.durationSeconds));
              }}
            >
              {/* Played Bar */}
              <div
                className="h-full bg-[#c9a227] transition-all"
                style={{
                  width: `${(currentTime / (duration || film.durationSeconds)) * 100}%`
                }}
              />

              {/* Chapter Pips */}
              {film.chapters.map((ch, idx) => {
                const pct = (ch.time / (duration || film.durationSeconds)) * 100;
                return (
                  <div
                    key={`${ch.time}-${idx}`}
                    title={ch.title}
                    className="absolute top-0 bottom-0 w-0.5 bg-[#ede6d8]/60 hover:bg-[#c9a227] hover:w-1 transition-all"
                    style={{ left: `${pct}%` }}
                  />
                );
              })}
            </div>

            {/* Lower Controls Row */}
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Play / Pause */}
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="p-1.5 text-[#ede6d8] hover:text-[#c9a227] transition-colors rounded-[2px] hover:bg-[#221e17]"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>

                {/* Rewind -10s */}
                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  aria-label="Rewind 10 seconds"
                  className="p-1 text-[#8a8070] hover:text-[#ede6d8] transition-colors hidden sm:inline-flex items-center"
                  title="Rewind 10s"
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>

                {/* Forward +10s */}
                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  aria-label="Forward 10 seconds"
                  className="p-1 text-[#8a8070] hover:text-[#ede6d8] transition-colors hidden sm:inline-flex items-center"
                  title="Forward 10s"
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                {/* Mute Toggle */}
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="p-1.5 text-[#ede6d8] hover:text-[#c9a227] transition-colors rounded-[2px] hover:bg-[#221e17]"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                {/* Time Display */}
                <span className="text-[11px] text-[#8a8070]">
                  {formatTime(currentTime)} / {formatTime(duration || film.durationSeconds)}
                </span>

                {/* Active Chapter Label */}
                {activeChapter && (
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-mono text-[#c9a227] bg-[#221e17] border border-[#3a352c] rounded-[2px] truncate max-w-[200px]">
                    {activeChapter.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Speed Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1a1712] border border-[#3a352c] text-[#8a8070] hover:text-[#ede6d8] rounded-[2px] transition-colors"
                  >
                    {playbackSpeed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-1 bg-[#171410] border border-[#3a352c] rounded-[3px] p-1 shadow-lg flex flex-col gap-0.5 z-40">
                      {[0.75, 1.0, 1.25, 1.5].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => handleSpeedSelect(spd)}
                          className={`px-2 py-1 text-[10px] font-mono text-left rounded-[2px] transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-[#c9a227] text-[#100e0c] font-semibold'
                              : 'text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#221e17]'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitles Toggle */}
                <button
                  type="button"
                  onClick={toggleCaptions}
                  aria-label={showCaptions ? 'Disable Subtitles' : 'Enable Subtitles'}
                  className={`p-1.5 transition-colors rounded-[2px] ${
                    showCaptions ? 'text-[#c9a227] bg-[#28241c]' : 'text-[#8a8070] hover:text-[#ede6d8]'
                  }`}
                  title="Toggle Subtitles (C)"
                >
                  <Subtitles className="w-4 h-4" />
                </button>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Toggle Fullscreen"
                  className="p-1.5 text-[#8a8070] hover:text-[#ede6d8] transition-colors rounded-[2px] hover:bg-[#221e17]"
                  title="Fullscreen (F)"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dossier Lower Details & Chapters Section */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#14120f] space-y-6">
          {/* Top Row: Hook & Call to Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#3a352c]">
            <div className="space-y-1">
              <p className="text-sm md:text-base text-[#d6cebf] font-sans leading-relaxed">
                {film.hook}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {film.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] font-mono text-[#8a8070] bg-[#1a1712] border border-[#2b251d] rounded-[2px]"
                  >
                    #{tag}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8a8070] ml-2">
                  <Clock className="w-3 h-3 text-[#c9a227]" />
                  {film.runtime}
                </span>
              </div>
            </div>

            {onAnalyzeEmail && (
              <button
                type="button"
                onClick={() => {
                  trackStoryEvent('cta_click', { film: film.slug, cta: 'analyze_own_email' });
                  handleClose();
                  onAnalyzeEmail();
                }}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold tracking-wider uppercase bg-[#c9a227] text-[#14120f] hover:bg-[#dec052] rounded-[3px] transition-all shadow-[0_2px_12px_rgba(201,162,39,0.2)]"
              >
                Analyze your own email
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chapters Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#8a8070] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
                Forensic Case Chapters
              </h3>
              <span className="text-[11px] font-mono text-[#8a8070]">Click to seek</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {film.chapters.map((ch, idx) => {
                const isSelected = activeChapter?.time === ch.time;
                return (
                  <button
                    key={`${ch.time}-${idx}`}
                    type="button"
                    onClick={() => handleSeek(ch.time)}
                    className={`flex items-start gap-2.5 p-2.5 text-left border rounded-[3px] transition-all ${
                      isSelected
                        ? 'bg-[#221e17] border-[#c9a227] text-[#ede6d8]'
                        : 'bg-[#171410] border-[#3a352c] text-[#8a8070] hover:border-[#574f42] hover:text-[#d6cebf]'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#c9a227] shrink-0 mt-0.5">
                      {formatTime(ch.time)}
                    </span>
                    <span className="text-xs font-sans font-medium line-clamp-2">
                      {ch.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* "What TraceXMail Did" Forensic Breakdown */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[#8a8070] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#c9a227]" />
                  What TraceXMail Did in this Incident
                </h3>
              </div>

              {/* Status Legend Trigger */}
              <button
                type="button"
                onClick={() => setShowLegendModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#c9a227] hover:underline"
              >
                <Info className="w-3 h-3" />
                Feature Status Legend
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {film.features.map((feat, idx) => {
                const isInApp = feat.status === 'in_app';
                return (
                  <div
                    key={`${feat.label}-${idx}`}
                    className={`p-3 border rounded-[3px] flex flex-col justify-between gap-1.5 ${
                      isInApp
                        ? 'bg-[#171410] border-[#3a352c]'
                        : 'bg-[#12100e] border-[#3a352c]/60 border-dashed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-serif font-medium text-[#ede6d8]">
                        {feat.label}
                      </span>
                      {isInApp ? (
                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-mono tracking-wider uppercase bg-[#1f281f] text-[#68d391] border border-[#68d391]/30 rounded-[2px] flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          IN THE APP
                        </span>
                      ) : (
                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-mono tracking-wider uppercase bg-[#28211a] text-[#dec052] border border-[#dec052]/30 rounded-[2px] flex items-center gap-1">
                          <HelpCircle className="w-2.5 h-2.5" />
                          CONCEPT
                        </span>
                      )}
                    </div>
                    {feat.description && (
                      <p className="text-[11px] font-sans text-[#8a8070] leading-snug">
                        {feat.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transcript / Forensic Summary Section */}
          {film.transcripts?.[currentLang] && (
            <div className="p-3.5 bg-[#100e0c] border border-[#3a352c] rounded-[3px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8a8070]">
                  Forensic Spoken Transcript ({currentLang.toUpperCase()})
                </span>
              </div>
              <p className="text-xs font-sans text-[#b9af9c] leading-relaxed">
                {film.transcripts[currentLang]}
              </p>
            </div>
          )}
        </div>

        {/* Legend Modal Dialog Overlay */}
        {showLegendModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Platform Feature Status Legend"
            className="absolute inset-0 z-50 bg-[#000000]/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[#171410] border border-[#3a352c] rounded-[3px] p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#3a352c] pb-3">
                <h4 className="text-sm font-serif font-medium text-[#ede6d8] flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#c9a227]" />
                  Forensic Capabilities Classification
                </h4>
                <button
                  type="button"
                  onClick={() => setShowLegendModal(false)}
                  className="text-[#8a8070] hover:text-[#ede6d8]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#100e0c] border border-[#3a352c] rounded-[3px] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1f281f] text-[#68d391] border border-[#68d391]/30 rounded-[2px]">
                      IN THE APP
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#ede6d8]">
                      {statusLegend.in_app.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#8a8070] font-sans">
                    {statusLegend.in_app.description}
                  </p>
                </div>

                <div className="p-3 bg-[#100e0c] border border-[#3a352c] rounded-[3px] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#28211a] text-[#dec052] border border-[#dec052]/30 rounded-[2px]">
                      CONCEPT
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#ede6d8]">
                      {statusLegend.concept.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#8a8070] font-sans">
                    {statusLegend.concept.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowLegendModal(false)}
                  className="px-3 py-1.5 text-xs font-mono uppercase bg-[#221e17] text-[#ede6d8] border border-[#3a352c] hover:border-[#c9a227] rounded-[3px]"
                >
                  Close Legend
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
