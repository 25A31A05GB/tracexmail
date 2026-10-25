/**
 * Forensic Cinema Audio & Narration Engine
 * Combines Web Audio API (ambient telemetry and cinematic resonance)
 * with Web Speech API (spoken dialogue in English, Hindi, and Telugu).
 */

class ForensicAudioEngine {
  private audioCtx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private isInitialized = false;
  private isMuted = false;
  private volume = 0.8;
  private playbackRate = 1.0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastSpokenText: string | null = null;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.ambientGain.connect(this.audioCtx.destination);
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('[ForensicAudio] Web Audio initialization skipped:', e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAmbient();
      this.cancelSpeech();
    } else {
      this.applyAmbientVolume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyAmbientVolume();
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public startAmbient() {
    if (this.isMuted || !this.isInitialized || !this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      if (this.ambientOsc) {
        this.applyAmbientVolume();
        return;
      }

      // Warm analog low-frequency drone (55Hz A1)
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.audioCtx.currentTime);

      // Subtle harmonic overtone (110Hz A2)
      const osc2 = this.audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(110, this.audioCtx.currentTime);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, this.audioCtx.currentTime);

      osc.connect(filter);
      osc2.connect(filter);
      if (this.ambientGain) {
        filter.connect(this.ambientGain);
      }

      osc.start();
      osc2.start();

      this.ambientOsc = osc;
      this.ambientOsc2 = osc2;
      this.applyAmbientVolume();
    } catch {
      // Audio context may require user gesture
    }
  }

  public stopAmbient() {
    if (!this.audioCtx || !this.ambientGain) return;
    try {
      this.ambientGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
    } catch {}
  }

  private applyAmbientVolume() {
    if (!this.audioCtx || !this.ambientGain) return;
    try {
      const targetGain = this.isMuted ? 0 : this.volume * 0.08; // Subtle background level
      this.ambientGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.2);
    } catch {}
  }

  /**
   * Plays a crisp forensic telemetry blip when packets hop or verification seals trigger.
   */
  public playTelemetryChirp(freq = 880) {
    if (this.isMuted || !this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioCtx.currentTime + 0.08);

      const chirpGain = this.volume * 0.04;
      gain.gain.setValueAtTime(chirpGain, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.12);
    } catch {}
  }

  /**
   * Speaks the current dialogue cue via SpeechSynthesis in the active language.
   */
  public speakCue(text: string, lang: 'en' | 'hi' | 'te') {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text || text.trim() === '' || text === this.lastSpokenText) return;

    try {
      window.speechSynthesis.cancel();
      this.lastSpokenText = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.playbackRate;
      utterance.pitch = 1.0;
      utterance.volume = this.volume;

      const langMap: Record<string, string> = {
        en: 'en-US',
        hi: 'hi-IN',
        te: 'te-IN'
      };
      utterance.lang = langMap[lang] || 'en-US';

      // Pick a matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const targetLang = utterance.lang.toLowerCase();
      const matchingVoice = voices.find(
        (v) => v.lang.toLowerCase() === targetLang || v.lang.toLowerCase().startsWith(lang)
      );
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[ForensicAudio] Speech synthesis notice:', err);
    }
  }

  public pauseSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
    this.stopAmbient();
  }

  public resumeSpeech() {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}
    }
    this.startAmbient();
  }

  public cancelSpeech() {
    this.lastSpokenText = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public destroy() {
    this.cancelSpeech();
    this.stopAmbient();
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
      } catch {}
      this.ambientOsc = null;
    }
    if (this.ambientOsc2) {
      try {
        this.ambientOsc2.stop();
        this.ambientOsc2.disconnect();
      } catch {}
      this.ambientOsc2 = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.isInitialized = false;
  }
}

export const forensicAudio = new ForensicAudioEngine();
