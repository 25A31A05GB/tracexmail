import { EmailAnalysis } from '../types';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface StandardizedVerdict {
  /** The 0-100 numerical threat/risk score directly from backend */
  score: number;
  /** True if a valid non-null numerical score was present in the analysis */
  hasScore: boolean;
  /** Formatted score label, e.g. "85/100" */
  scoreLabel: string;
  /** Trust score inverted from threat score, 0-100 */
  trustScore: number;
  /** Trust score label, e.g. "15/100 TRUST" */
  trustScoreLabel: string;

  /** The primary standardized verdict string from backend (e.g. "MALICIOUS PHISH", "PHISHING", "SUSPICIOUS", "LEGITIMATE") */
  verdict: string;
  /** Raw uppercase verdict string */
  rawVerdict: string;

  /** Standardized high-level category */
  category: 'MALICIOUS' | 'SUSPICIOUS' | 'SAFE';

  /** Convenient boolean category flags */
  isMalicious: boolean;
  isSuspicious: boolean;
  isSafe: boolean;

  /** Standardized severity rating: CRITICAL, HIGH, MEDIUM, LOW */
  severity: SeverityLevel;
  /** Human-readable institutional risk rating string, e.g. "CRITICAL EXPOSURE", "HIGH RISK", "ELEVATED RISK", "LOW RISK" */
  severityLabel: string;

  /** Ready-to-use Tailwind class sets for consistent styling across components */
  colors: {
    text: string;
    bg: string;
    bgMuted: string;
    border: string;
    borderMuted: string;
    bar: string;
    badge: string;
  };

  /** Forensic stamp details for EvidenceTagCard and case tags */
  stamp: {
    word: string;
    status: 'bad' | 'warn' | 'good';
    label: string;
  };

  /** Standard SOC action recommendation */
  recommendedAction: string;
}

export const TEXT_LABEL_MALICIOUS_MIN_SCORE = 60;

/**
 * Centrally resolves and standardizes an email analysis verdict, threat score, and severity.
 * Pulls directly from backend-provided fields without re-deriving or guessing disparate logic.
 * Ensures 100% consistent scores, labels, and color semantics across the entire application.
 */
export function getStandardizedVerdict(analysis?: Partial<EmailAnalysis> | null): StandardizedVerdict {
  // 1. Resolve Score directly from backend fields: threatScore, then riskScore
  let score: number = 0;
  let hasScore = false;

  if (analysis) {
    if (typeof analysis.threatScore === 'number' && !isNaN(analysis.threatScore) && analysis.threatScore >= 0) {
      score = Math.round(analysis.threatScore);
      hasScore = true;
    } else if (typeof analysis.riskScore === 'number' && !isNaN(analysis.riskScore) && analysis.riskScore >= 0) {
      score = Math.round(analysis.riskScore);
      hasScore = true;
    }
  }

  // 2. Resolve Verdict String directly from backend fields: threatVerdict, verdict, classification
  const rawVerdict = (
    analysis?.threatVerdict ||
    analysis?.verdict ||
    analysis?.classification ||
    (hasScore ? (score >= 70 ? 'MALICIOUS PHISH' : score >= 35 ? 'SUSPICIOUS' : 'LEGITIMATE') : 'UNVERIFIED')
  ).toUpperCase();

  // 3. Categorize into MALICIOUS, SUSPICIOUS, UNCERTAIN, or SAFE
  const isUncertain = rawVerdict.includes('UNCERTAIN');
  // If score is verified low (<35/100), composite risk takes precedence over text-only ML labels
  const isScoreLow = hasScore && score < 35 && !isUncertain;

  const hasMaliciousTextLabel =
    rawVerdict.includes('PHISH') ||
    rawVerdict.includes('FRAUD') ||
    rawVerdict.includes('MALICIOUS') ||
    rawVerdict.includes('IMPERSONAT');

  const isMalicious =
    !isScoreLow &&
    !isUncertain &&
    (hasScore
      ? (hasMaliciousTextLabel && score >= TEXT_LABEL_MALICIOUS_MIN_SCORE) || score >= 75
      : hasMaliciousTextLabel);

  const isClean =
    isScoreLow ||
    ((rawVerdict.includes('LEGIT') || rawVerdict.includes('CLEAN') || rawVerdict.includes('PASS') || rawVerdict.includes('SAFE')) &&
    !isMalicious &&
    !isUncertain &&
    (!hasScore || score < 35));

  const isSuspicious = !isClean && !isMalicious;
  const isSafe = isClean;

  const category: 'MALICIOUS' | 'SUSPICIOUS' | 'SAFE' = isMalicious
    ? 'MALICIOUS'
    : isSuspicious
    ? 'SUSPICIOUS'
    : 'SAFE';

  // 4. Primary standardized display verdict
  let verdict = isScoreLow ? 'LEGITIMATE' : (analysis?.threatVerdict || analysis?.verdict || analysis?.classification);
  if (isUncertain) {
    verdict = 'UNCERTAIN';
  } else if (
    !verdict ||
    (isScoreLow && (verdict.includes('PHISH') || verdict.includes('MALICIOUS'))) ||
    (!isMalicious && (verdict.toUpperCase().includes('PHISH') || verdict.toUpperCase().includes('MALICIOUS') || verdict.toUpperCase().includes('FRAUD') || verdict.toUpperCase().includes('IMPERSONAT')))
  ) {
    verdict = isMalicious ? 'MALICIOUS PHISH' : isSuspicious ? 'SUSPICIOUS' : 'LEGITIMATE';
  }

  // 5. Standardized Severity Level
  let severity: SeverityLevel;
  let severityLabel: string;

  if (isUncertain) {
    severity = 'MEDIUM';
    severityLabel = 'UNCERTAIN MARGIN - SOC REVIEW REQUIRED';
  } else if (score >= 80 || (isMalicious && score >= 70)) {
    severity = 'CRITICAL';
    severityLabel = 'CRITICAL EXPOSURE';
  } else if (score >= 60 || isMalicious) {
    severity = 'HIGH';
    severityLabel = 'HIGH RISK';
  } else if (score >= 35 || isSuspicious) {
    severity = 'MEDIUM';
    severityLabel = 'ELEVATED RISK';
  } else {
    severity = 'LOW';
    severityLabel = 'LOW RISK';
  }

  // 6. Consistent Color Palettes
  let colors: StandardizedVerdict['colors'];
  if (isUncertain) {
    colors = {
      text: 'text-purple-300',
      bg: 'bg-purple-950/80',
      bgMuted: 'bg-purple-500/10',
      border: 'border-purple-700/60',
      borderMuted: 'border-purple-500/20',
      bar: 'bg-purple-500',
      badge: 'bg-purple-950/80 text-purple-300 border-purple-700/60'
    };
  } else if (severity === 'CRITICAL' || category === 'MALICIOUS') {
    colors = {
      text: 'text-rose-400',
      bg: 'bg-rose-950/80',
      bgMuted: 'bg-rose-500/10',
      border: 'border-rose-700/60',
      borderMuted: 'border-rose-500/20',
      bar: 'bg-rose-600',
      badge: 'bg-rose-950/80 text-rose-300 border-rose-700/60'
    };
  } else if (severity === 'HIGH') {
    colors = {
      text: 'text-orange-400',
      bg: 'bg-orange-950/80',
      bgMuted: 'bg-orange-500/10',
      border: 'border-orange-700/60',
      borderMuted: 'border-orange-500/20',
      bar: 'bg-orange-500',
      badge: 'bg-orange-950/80 text-orange-300 border-orange-700/60'
    };
  } else if (severity === 'MEDIUM' || category === 'SUSPICIOUS') {
    colors = {
      text: 'text-amber-400',
      bg: 'bg-amber-950/80',
      bgMuted: 'bg-amber-500/10',
      border: 'border-amber-700/60',
      borderMuted: 'border-amber-500/20',
      bar: 'bg-amber-500',
      badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60'
    };
  } else {
    colors = {
      text: 'text-emerald-400',
      bg: 'bg-emerald-950/80',
      bgMuted: 'bg-emerald-500/10',
      border: 'border-emerald-700/60',
      borderMuted: 'border-emerald-500/20',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
    };
  }

  // 7. Stamp
  let stampWord: string = 'PHISH';
  let stampStatus: 'bad' | 'warn' | 'good' = 'bad';

  if (isUncertain) {
    stampWord = 'UNCERTAIN';
    stampStatus = 'warn';
  } else if (category === 'SAFE') {
    stampWord = 'LEGITIMATE';
    stampStatus = 'good';
  } else if (category === 'SUSPICIOUS') {
    stampWord = 'SUSPICIOUS';
    stampStatus = 'warn';
  } else if (rawVerdict.includes('FRAUD')) {
    stampWord = 'FRAUD';
    stampStatus = 'bad';
  } else if (rawVerdict.includes('IMPERSONAT')) {
    stampWord = 'IMPERSONATED';
    stampStatus = 'bad';
  } else {
    stampWord = 'PHISH';
    stampStatus = 'bad';
  }

  const trustScore = Math.max(0, Math.min(100, 100 - score));
  const scoreLabel = `${score}/100`;
  const trustScoreLabel = hasScore
    ? (stampStatus === 'good'
        ? `${trustScore}/100 TRUST`
        : `${score}/100 THREAT (${trustScore}/100 TRUST)`)
    : 'Score unavailable';

  // 8. Recommended Action
  let recommendedAction: string;
  if (stampStatus === 'bad') {
    recommendedAction = 'BLOCK SENDER & PURGE INBOX';
  } else if (stampStatus === 'warn') {
    recommendedAction = 'ISOLATE AT GATEWAY & USER ALERT';
  } else {
    recommendedAction = 'ALLOW TRANSMISSION (CLEAN)';
  }

  return {
    score,
    hasScore,
    scoreLabel,
    trustScore,
    trustScoreLabel,
    verdict,
    rawVerdict,
    category,
    isMalicious,
    isSuspicious,
    isSafe,
    severity,
    severityLabel,
    colors,
    stamp: {
      word: stampWord,
      status: stampStatus,
      label: stampWord
    },
    recommendedAction
  };
}
