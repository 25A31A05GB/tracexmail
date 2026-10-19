import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { normalizeUnicode } from './languageDetector';

export interface LanguageLexicon {
  language: string;
  urgency: string[];
  financial: string[];
  authority: string[];
  credentials: string[];
  threatIndicators: string[];
}

export interface LexiconMatchResult {
  hasUrgency: boolean;
  hasFinancial: boolean;
  hasAuthority: boolean;
  hasCredentials: boolean;
  matchedTerms: Array<{ category: string; term: string }>;
  riskBoost: number;
}

const lexiconCache = new Map<string, LanguageLexicon>();

function getLexiconFilePath(lang: string): string {
  return path.join(process.cwd(), `config/lexicons/${lang.toLowerCase()}.json`);
}

/**
 * Loads the lexicon for a specific language code, falling back to 'en'.
 */
export function getLanguageLexicon(lang: string = 'en'): LanguageLexicon {
  const cleanLang = lang.toLowerCase();
  if (lexiconCache.has(cleanLang)) {
    return lexiconCache.get(cleanLang)!;
  }

  const filePath = getLexiconFilePath(cleanLang);
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      lexiconCache.set(cleanLang, parsed);
      return parsed;
    } catch (e: any) {
      logger.warn({ lang: cleanLang, error: e.message }, 'Failed to parse language lexicon JSON');
    }
  }

  // Fallback to English
  if (cleanLang !== 'en') {
    return getLanguageLexicon('en');
  }

  // Built-in emergency fallback if file is missing
  const fallbackEn: LanguageLexicon = {
    language: 'en',
    urgency: ['urgent', 'immediately', 'within 24 hours', 'immediate action', 'suspended', 'expires today', 'final warning'],
    financial: ['wire transfer', 'invoice', 'payment', 'bank account', 'remittance', 'cryptocurrency', 'bitcoin', 'payroll', 'settlement'],
    authority: ['ceo', 'chief executive', 'executive office', 'board of directors', 'hr department', 'it support', 'compliance team'],
    credentials: ['password reset', 'verify account', 'login attempt', 'security code', '2fa token', 'update credentials'],
    threatIndicators: ['confidential', 'keep private', 'do not call', 'wire instructions updated', 'urgent transaction']
  };
  lexiconCache.set('en', fallbackEn);
  return fallbackEn;
}

/**
 * Evaluates text using the language-aware lexicon.
 */
export function evaluateMultilingualLexicon(
  text: string,
  detectedLanguage: string = 'en'
): LexiconMatchResult {
  const normalized = normalizeUnicode(text || '').toLowerCase();
  const lexicon = getLanguageLexicon(detectedLanguage);
  const matchedTerms: Array<{ category: string; term: string }> = [];

  const checkCategory = (terms: string[], categoryName: string): boolean => {
    let hit = false;
    for (const term of terms) {
      const cleanTerm = term.toLowerCase();
      if (normalized.includes(cleanTerm)) {
        hit = true;
        matchedTerms.push({ category: categoryName, term });
      }
    }
    return hit;
  };

  const hasUrgency = checkCategory(lexicon.urgency || [], 'URGENCY');
  const hasFinancial = checkCategory(lexicon.financial || [], 'FINANCIAL');
  const hasAuthority = checkCategory(lexicon.authority || [], 'AUTHORITY');
  const hasCredentials = checkCategory(lexicon.credentials || [], 'CREDENTIALS');
  const hasThreat = checkCategory(lexicon.threatIndicators || [], 'THREAT_INDICATOR');

  let riskBoost = 0;
  if (hasUrgency) riskBoost += 15;
  if (hasFinancial) riskBoost += 20;
  if (hasAuthority) riskBoost += 15;
  if (hasCredentials) riskBoost += 20;
  if (hasThreat) riskBoost += 25;

  // Synergistic BEC bonus: Urgency + Financial + Authority together
  if (hasUrgency && hasFinancial && hasAuthority) {
    riskBoost += 20;
  }

  return {
    hasUrgency,
    hasFinancial,
    hasAuthority,
    hasCredentials,
    matchedTerms,
    riskBoost: Math.min(60, riskBoost)
  };
}
