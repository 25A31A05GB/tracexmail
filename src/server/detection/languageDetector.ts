export interface LanguageDetectionResult {
  detectedLanguage: string; // ISO 639-1 code: en, hi, es, fr, de, pt, ar, zh, ja, ru, etc.
  languageName: string;
  confidence: number; // 0.0 - 1.0
  isRtl: boolean;
  script: 'Latin' | 'Devanagari' | 'Arabic' | 'Han' | 'Japanese' | 'Cyrillic' | 'Other';
  hasMixedScripts: boolean;
  mixedScriptsList: string[];
  isSupported: boolean;
  isLimitedSupport: boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  pt: 'Portuguese (Português)',
  ar: 'Arabic (العربية)',
  zh: 'Chinese (中文)',
  ja: 'Japanese (日本語)',
  ru: 'Russian (Русский)',
  und: 'Undetermined'
};

// High-confidence tier languages with extensive training/lexicons
const FULLY_SUPPORTED_LANGUAGES = new Set(['en', 'es', 'fr', 'de', 'pt']);
// Languages supported with rule-based/script lexicons and model card notices
const LIMITED_SUPPORT_LANGUAGES = new Set(['hi', 'ar', 'zh', 'ja', 'ru']);

// Stopwords and indicative frequency trigrams for Latin-script differentiation
const LATIN_PROFILES: Record<string, string[]> = {
  es: ['de', 'la', 'que', 'el', 'en', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más'],
  fr: ['de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'ce', 'il', 'pas', 'sur', 'au'],
  de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als'],
  pt: ['de', 'que', 'não', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como'],
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at']
};

/**
 * Normalizes Unicode using Canonical Decomposition followed by Canonical Composition (NFKC).
 */
export function normalizeUnicode(text: string): string {
  if (!text) return '';
  return text.normalize('NFKC');
}

/**
 * Detects Unicode scripts and mixed-script homoglyphic content.
 */
export function analyzeScripts(text: string): {
  primaryScript: LanguageDetectionResult['script'];
  scripts: string[];
  hasMixedScripts: boolean;
} {
  const counts: Record<string, number> = {
    Latin: 0,
    Devanagari: 0,
    Arabic: 0,
    Han: 0,
    Japanese: 0,
    Cyrillic: 0,
    Other: 0
  };

  for (const char of text) {
    const code = char.codePointAt(0) || 0;

    // Latin
    if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x024f)) {
      counts.Latin++;
    }
    // Devanagari (Hindi, Marathi, Sanskrit)
    else if (code >= 0x0900 && code <= 0x097f) {
      counts.Devanagari++;
    }
    // Arabic (Arabic, Urdu, Persian)
    else if ((code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f) || (code >= 0x08a0 && code <= 0x08ff)) {
      counts.Arabic++;
    }
    // Japanese Hiragana & Katakana
    else if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) {
      counts.Japanese++;
    }
    // Han / CJK Ideographs (Chinese, Kanji)
    else if (code >= 0x4e00 && code <= 0x9fff) {
      counts.Han++;
    }
    // Cyrillic (Russian, Ukrainian, etc.)
    else if (code >= 0x0400 && code <= 0x04ff) {
      counts.Cyrillic++;
    } else if (/\p{L}/u.test(char)) {
      counts.Other++;
    }
  }

  const scriptsPresent = Object.entries(counts)
    .filter(([_, count]) => count > 5)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);

  const primary = (scriptsPresent[0] || 'Latin') as LanguageDetectionResult['script'];
  // Mixed script detection (e.g. Latin mixed with Cyrillic or Arabic)
  const hasMixed = scriptsPresent.length >= 2 && counts[scriptsPresent[1]] > (counts[primary] * 0.05);

  return {
    primaryScript: primary,
    scripts: scriptsPresent,
    hasMixedScripts: hasMixed
  };
}

/**
 * Identifies language of an email subject + body with Unicode NFKC normalization.
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const normalized = normalizeUnicode(text || '').trim();
  if (normalized.length < 5) {
    return {
      detectedLanguage: 'en',
      languageName: 'English (Default)',
      confidence: 0.5,
      isRtl: false,
      script: 'Latin',
      hasMixedScripts: false,
      mixedScriptsList: [],
      isSupported: true,
      isLimitedSupport: false
    };
  }

  const scriptAnalysis = analyzeScripts(normalized);

  // 1. Script-based identification for distinct Unicode alphabets
  if (scriptAnalysis.primaryScript === 'Devanagari') {
    return {
      detectedLanguage: 'hi',
      languageName: LANGUAGE_NAMES.hi,
      confidence: 0.95,
      isRtl: false,
      script: 'Devanagari',
      hasMixedScripts: scriptAnalysis.hasMixedScripts,
      mixedScriptsList: scriptAnalysis.scripts,
      isSupported: true,
      isLimitedSupport: true
    };
  }

  if (scriptAnalysis.primaryScript === 'Arabic') {
    return {
      detectedLanguage: 'ar',
      languageName: LANGUAGE_NAMES.ar,
      confidence: 0.95,
      isRtl: true,
      script: 'Arabic',
      hasMixedScripts: scriptAnalysis.hasMixedScripts,
      mixedScriptsList: scriptAnalysis.scripts,
      isSupported: true,
      isLimitedSupport: true
    };
  }

  if (scriptAnalysis.primaryScript === 'Japanese') {
    return {
      detectedLanguage: 'ja',
      languageName: LANGUAGE_NAMES.ja,
      confidence: 0.95,
      isRtl: false,
      script: 'Japanese',
      hasMixedScripts: scriptAnalysis.hasMixedScripts,
      mixedScriptsList: scriptAnalysis.scripts,
      isSupported: true,
      isLimitedSupport: true
    };
  }

  if (scriptAnalysis.primaryScript === 'Han') {
    return {
      detectedLanguage: 'zh',
      languageName: LANGUAGE_NAMES.zh,
      confidence: 0.92,
      isRtl: false,
      script: 'Han',
      hasMixedScripts: scriptAnalysis.hasMixedScripts,
      mixedScriptsList: scriptAnalysis.scripts,
      isSupported: true,
      isLimitedSupport: true
    };
  }

  if (scriptAnalysis.primaryScript === 'Cyrillic') {
    return {
      detectedLanguage: 'ru',
      languageName: LANGUAGE_NAMES.ru,
      confidence: 0.92,
      isRtl: false,
      script: 'Cyrillic',
      hasMixedScripts: scriptAnalysis.hasMixedScripts,
      mixedScriptsList: scriptAnalysis.scripts,
      isSupported: true,
      isLimitedSupport: true
    };
  }

  // 2. Latin-script classification using word token profiles
  const tokens = normalized
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const scores: Record<string, number> = { en: 0, es: 0, fr: 0, de: 0, pt: 0 };

  for (const token of tokens) {
    for (const [lang, wordList] of Object.entries(LATIN_PROFILES)) {
      if (wordList.includes(token)) {
        scores[lang] += 1;
      }
    }
  }

  let bestLang = 'en';
  let bestScore = -1;
  let totalScore = 0;

  for (const [lang, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  const confidence = totalScore > 0 ? Math.min(0.98, Math.max(0.6, bestScore / (totalScore || 1))) : 0.7;

  return {
    detectedLanguage: bestLang,
    languageName: LANGUAGE_NAMES[bestLang] || 'English',
    confidence,
    isRtl: false,
    script: 'Latin',
    hasMixedScripts: scriptAnalysis.hasMixedScripts,
    mixedScriptsList: scriptAnalysis.scripts,
    isSupported: true,
    isLimitedSupport: LIMITED_SUPPORT_LANGUAGES.has(bestLang)
  };
}
