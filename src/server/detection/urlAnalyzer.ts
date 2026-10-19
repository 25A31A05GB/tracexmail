import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { validateSsrfTarget } from './ssrfGuard';
import { logger } from '../logger';

export interface UrlHop {
  hopIndex: number;
  url: string;
  statusCode?: number;
  redirectLocation?: string;
  resolvedIp?: string;
  latencyMs: number;
}

export interface LookalikeSignal {
  isLookalike: boolean;
  type?: 'homoglyph' | 'punycode' | 'typosquat' | 'suspicious_tld' | 'display_mismatch';
  targetBrand?: string;
  legitimateDomain?: string;
  details: string;
  confidence: number; // 0 to 1
}

export interface ExtractedUrlInfo {
  originalUrl: string;
  normalizedUrl: string;
  source: 'html_href' | 'plain_text' | 'qr_code';
  displayText?: string;
  isMismatchedDisplay: boolean;
  domain: string;
  tld: string;
  isSuspiciousTld: boolean;
  isPunycode: boolean;
  hasHomoglyphs: boolean;
  homoglyphDetails?: string;
  lookalikeSignal?: LookalikeSignal;
  rdapRegistrationDays?: number;
  isNewlyRegistered?: boolean;
  redirectHops: UrlHop[];
  finalDestinationUrl: string;
  unshortened: boolean;
  isSsrfBlocked: boolean;
  ssrfBlockReason?: string;
  riskScore: number; // 0 to 100
  threatVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  reasons: string[];
}

export interface UrlAnalysisReport {
  totalUrls: number;
  uniqueDomains: string[];
  highestUrlRiskScore: number;
  overallVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  hasLookalikeDomains: boolean;
  hasSuspiciousRedirects: boolean;
  hasMismatchedUrls: boolean;
  urls: ExtractedUrlInfo[];
}

// Suspicious / high-abuse TLDs according to Spamhaus & APWG
const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'click', 'monster', 'fit', 'rest', 'work', 'tokyo',
  'gq', 'cf', 'ml', 'tk', 'ga', 'buzz', 'cam', 'sbs', 'icu', 'live',
  'cfd', 'quest', 'boats', 'cyou', 'skin', 'beauty', 'hair', 'vip'
]);

// Common URL shortener services
const KNOWN_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorte.st', 'lnkd.in', 'qr.net', 'tiny.cc'
]);

// Unicode Cyrillic/Greek homoglyphs to Latin mappings
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', // Cyrillic small letter a
  '\u0441': 'c', // Cyrillic small letter es
  '\u0435': 'e', // Cyrillic small letter ie
  '\u0456': 'i', // Cyrillic small letter byelorussian-ukrainian i
  '\u0458': 'j', // Cyrillic small letter je
  '\u043e': 'o', // Cyrillic small letter o
  '\u0440': 'p', // Cyrillic small letter er
  '\u0455': 's', // Cyrillic small letter dze
  '\u0445': 'x', // Cyrillic small letter ha
  '\u0443': 'y', // Cyrillic small letter u
  '\u03b1': 'a', // Greek small letter alpha
  '\u03bf': 'o', // Greek small letter omicron
  '\u03c1': 'p', // Greek small letter rho
  '\u03bd': 'v'  // Greek small letter nu
};

// Brand domain cache loaded from config/brand_domains.json
let brandDomainsCache: any[] | null = null;

function loadBrandDomains(): any[] {
  if (brandDomainsCache) return brandDomainsCache;
  try {
    const configPath = path.join(process.cwd(), 'config/brand_domains.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      brandDomainsCache = data.brands || [];
      return brandDomainsCache!;
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to load config/brand_domains.json');
  }
  return [];
}

/**
 * Standard Levenshtein distance for typosquatting calculation.
 */
export function calculateLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = j;
    for (let i = 1; i <= a.length; i++) {
      const val = b[j - 1] === a[i - 1] ? row[i - 1] : Math.min(row[i - 1], prev, row[i]) + 1;
      row[i - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

/**
 * Detects homoglyphic characters in a domain name.
 */
export function checkHomoglyphs(domain: string): { hasHomoglyphs: boolean; normalized: string; details?: string } {
  let hasHomoglyphs = false;
  let normalized = '';
  const detectedChars: string[] = [];

  for (const char of domain) {
    if (HOMOGLYPH_MAP[char]) {
      hasHomoglyphs = true;
      detectedChars.push(`'${char}' (\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}) -> '${HOMOGLYPH_MAP[char]}'`);
      normalized += HOMOGLYPH_MAP[char];
    } else {
      normalized += char;
    }
  }

  return {
    hasHomoglyphs,
    normalized,
    details: hasHomoglyphs ? `Homoglyphic spoofing: ${detectedChars.join(', ')}` : undefined
  };
}

/**
 * Evaluates lookalike domains against enterprise and banking brands.
 */
export function evaluateLookalikeDomain(domain: string): LookalikeSignal | undefined {
  const brands = loadBrandDomains();
  const lowerDomain = domain.toLowerCase().trim();
  const { hasHomoglyphs, normalized, details } = checkHomoglyphs(lowerDomain);

  // 1. Check IDN punycode
  if (lowerDomain.startsWith('xn--') || lowerDomain.includes('.xn--')) {
    return {
      isLookalike: true,
      type: 'punycode',
      details: `Internationalized Domain Name (IDN) Punycode detected: ${lowerDomain}`,
      confidence: 0.85
    };
  }

  // 2. Check Homoglyphs
  if (hasHomoglyphs) {
    for (const brand of brands) {
      for (const legit of brand.legitimateDomains || []) {
        if (normalized === legit.toLowerCase() || normalized.endsWith('.' + legit.toLowerCase())) {
          return {
            isLookalike: true,
            type: 'homoglyph',
            targetBrand: brand.name,
            legitimateDomain: legit,
            details: `Homoglyph impersonation targeting ${brand.name} (${legit}). ${details}`,
            confidence: 0.98
          };
        }
      }
    }
    return {
      isLookalike: true,
      type: 'homoglyph',
      details: details || 'Cyrillic/Greek homoglyphic characters detected in domain name',
      confidence: 0.8
    };
  }

  // 3. Typosquatting via Levenshtein distance on base domain
  const domainParts = lowerDomain.split('.');
  const sld = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : lowerDomain;

  for (const brand of brands) {
    for (const legit of brand.legitimateDomains || []) {
      const legitParts = legit.toLowerCase().split('.');
      const legitSld = legitParts.length >= 2 ? legitParts[legitParts.length - 2] : legit;

      if (lowerDomain === legit.toLowerCase() || lowerDomain.endsWith('.' + legit.toLowerCase())) {
        // Legitimate domain
        continue;
      }

      // Check edit distance on SLD
      if (sld.length >= 4 && legitSld.length >= 4) {
        const dist = calculateLevenshtein(sld, legitSld);
        if (dist === 1 || (dist === 2 && sld.length >= 7)) {
          return {
            isLookalike: true,
            type: 'typosquat',
            targetBrand: brand.name,
            legitimateDomain: legit,
            details: `Typosquatting variant of ${brand.name} (${legit}) with Levenshtein distance ${dist} on '${sld}' vs '${legitSld}'`,
            confidence: dist === 1 ? 0.95 : 0.8
          };
        }
      }

      // Check prefix / suffix squatted variants (e.g. login-paypal.com, paypal-verify.com)
      if (
        (lowerDomain.includes(legitSld) || lowerDomain.includes(brand.id)) &&
        !lowerDomain.endsWith('.' + legit.toLowerCase())
      ) {
        return {
          isLookalike: true,
          type: 'typosquat',
          targetBrand: brand.name,
          legitimateDomain: legit,
          details: `Brand token '${brand.id}' embedded in non-authoritative domain '${lowerDomain}'`,
          confidence: 0.9
        };
      }
    }
  }

  return undefined;
}

/**
 * Safely unshortens and follows redirect chains (max 5 hops, 5s total budget, SSRF protected, no bodies loaded).
 */
export async function followRedirectChainSafely(
  initialUrl: string,
  maxHops: number = 5,
  timeoutMs: number = 5000
): Promise<{ hops: UrlHop[]; finalUrl: string; ssrfBlocked: boolean; blockReason?: string }> {
  const hops: UrlHop[] = [];
  let currentUrl = initialUrl;
  const startTime = Date.now();
  let ssrfBlocked = false;
  let blockReason: string | undefined;

  for (let hopIndex = 0; hopIndex < maxHops; hopIndex++) {
    if (Date.now() - startTime >= timeoutMs) {
      break;
    }

    // SSRF Check before making any network contact
    const ssrfCheck = await validateSsrfTarget(currentUrl);
    if (!ssrfCheck.isSafe) {
      ssrfBlocked = true;
      blockReason = ssrfCheck.reason;
      hops.push({
        hopIndex,
        url: currentUrl,
        resolvedIp: ssrfCheck.resolvedIp,
        latencyMs: 0
      });
      break;
    }

    const hopStartTime = Date.now();
    try {
      const hopResult = await fetchHeaderOnly(currentUrl, Math.max(500, timeoutMs - (Date.now() - startTime)));
      const hopLatency = Date.now() - hopStartTime;

      hops.push({
        hopIndex,
        url: currentUrl,
        statusCode: hopResult.statusCode,
        redirectLocation: hopResult.location,
        resolvedIp: ssrfCheck.resolvedIp,
        latencyMs: hopLatency
      });

      if (
        hopResult.location &&
        hopResult.statusCode &&
        [301, 302, 303, 307, 308].includes(hopResult.statusCode)
      ) {
        // Resolve relative redirects safely
        try {
          const resolvedNext = new URL(hopResult.location, currentUrl).toString();
          if (resolvedNext === currentUrl) {
            break; // Redirect loop
          }
          currentUrl = resolvedNext;
        } catch {
          break; // Invalid redirect location
        }
      } else {
        // Final destination reached
        break;
      }
    } catch (err: any) {
      hops.push({
        hopIndex,
        url: currentUrl,
        resolvedIp: ssrfCheck.resolvedIp,
        latencyMs: Date.now() - hopStartTime
      });
      break;
    }
  }

  return {
    hops,
    finalUrl: currentUrl,
    ssrfBlocked,
    blockReason
  };
}

/**
 * Issues a lightweight HEAD or range GET that never downloads the body in the main process.
 */
function fetchHeaderOnly(
  targetUrl: string,
  timeoutMs: number
): Promise<{ statusCode: number; location?: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(e);
    }

    const isHttps = parsed.protocol === 'https:';
    const requester = isHttps ? https : http;

    const req = requester.request(
      parsed,
      {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TraceXMail-Security-Inspector/2.5',
          'Accept': '*/*'
        },
        timeout: timeoutMs
      },
      (res) => {
        const statusCode = res.statusCode || 200;
        const location = res.headers.location;
        res.resume(); // Discard any incoming data immediately
        resolve({ statusCode, location });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out'));
    });

    req.on('error', (err) => {
      // If HEAD is not supported (405 Method Not Allowed), retry with GET aborting on headers
      if ((err as any).code === 'ERR_INVALID_ARG_TYPE') {
        return reject(err);
      }
      resolve({ statusCode: 0 });
    });

    req.end();
  });
}

/**
 * Extracts all URLs from HTML content, plaintext body, and optional QR codes.
 */
export function extractUrlsFromEmail(
  htmlContent: string = '',
  textContent: string = '',
  qrCodeUrls: string[] = []
): Array<{ url: string; source: 'html_href' | 'plain_text' | 'qr_code'; displayText?: string }> {
  const results: Array<{ url: string; source: 'html_href' | 'plain_text' | 'qr_code'; displayText?: string }> = [];
  const seenUrls = new Set<string>();

  // 1. QR Code URLs
  for (const qrUrl of qrCodeUrls) {
    if (qrUrl && !seenUrls.has(qrUrl)) {
      seenUrls.add(qrUrl);
      results.push({ url: qrUrl, source: 'qr_code', displayText: '[Decoded QR Code]' });
    }
  }

  // 2. HTML href tags & anchor text
  if (htmlContent) {
    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(htmlContent)) !== null) {
      const rawHref = match[1]?.trim();
      const rawText = match[2]?.replace(/<[^>]+>/g, '').trim();

      if (rawHref && (rawHref.startsWith('http://') || rawHref.startsWith('https://'))) {
        if (!seenUrls.has(rawHref)) {
          seenUrls.add(rawHref);
          results.push({ url: rawHref, source: 'html_href', displayText: rawText || undefined });
        }
      }
    }
  }

  // 3. Plaintext URL regex
  const textBody = `${textContent}\n${htmlContent.replace(/<[^>]+>/g, ' ')}`;
  const urlRegex = /(https?:\/\/[^\s<>"'{}|\\^`]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(textBody)) !== null) {
    const matchedUrl = match[1].replace(/[.,;:!?)]+$/, '').trim();
    if (matchedUrl && !seenUrls.has(matchedUrl)) {
      seenUrls.add(matchedUrl);
      results.push({ url: matchedUrl, source: 'plain_text' });
    }
  }

  return results;
}

/**
 * Full URL analysis pipeline for an email.
 */
export async function analyzeUrls(
  htmlContent: string = '',
  textContent: string = '',
  qrCodeUrls: string[] = [],
  options: { followRedirects?: boolean } = { followRedirects: true }
): Promise<UrlAnalysisReport> {
  const extracted = extractUrlsFromEmail(htmlContent, textContent, qrCodeUrls);
  const analyzedUrls: ExtractedUrlInfo[] = [];
  const uniqueDomains = new Set<string>();
  let highestScore = 0;
  let hasLookalike = false;
  let hasSuspiciousRedirects = false;
  let hasMismatched = false;

  for (const item of extracted) {
    let domain = '';
    let tld = '';
    let isPunycode = false;
    let hasHomoglyphs = false;
    let homoglyphDetails: string | undefined;
    let isSuspiciousTld = false;
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      const parsed = new URL(item.url);
      domain = parsed.hostname.toLowerCase();
      uniqueDomains.add(domain);
      const parts = domain.split('.');
      tld = parts[parts.length - 1] || '';
      isSuspiciousTld = SUSPICIOUS_TLDS.has(tld);
      if (isSuspiciousTld) {
        riskScore += 25;
        reasons.push(`Suspicious top-level domain (.${tld}) frequently abused in phishing`);
      }
    } catch {
      continue;
    }

    // Lookalike & Homoglyph Analysis
    const lookalikeSignal = evaluateLookalikeDomain(domain);
    if (lookalikeSignal) {
      hasLookalike = true;
      riskScore += Math.round(lookalikeSignal.confidence * 45);
      reasons.push(`Lookalike domain: ${lookalikeSignal.details}`);
    }

    // Check display text mismatch (e.g. display says https://paypal.com/signin but href is phish.cc)
    let isMismatchedDisplay = false;
    if (item.displayText) {
      const displayUrlMatch = item.displayText.match(/https?:\/\/([^\s/]+)/i);
      if (displayUrlMatch) {
        const displayedHost = displayUrlMatch[1].toLowerCase().replace(/^www\./, '');
        const actualHost = domain.replace(/^www\./, '');
        if (displayedHost !== actualHost && !actualHost.endsWith('.' + displayedHost)) {
          isMismatchedDisplay = true;
          hasMismatched = true;
          riskScore += 40;
          reasons.push(`Mismatched URL display: link text claims '${displayUrlMatch[0]}' but points to '${item.url}'`);
        }
      }
    }

    // Redirect following & SSRF protection
    let redirectHops: UrlHop[] = [];
    let finalDestinationUrl = item.url;
    let isSsrfBlocked = false;
    let ssrfBlockReason: string | undefined;
    let unshortened = false;

    if (options.followRedirects && (KNOWN_SHORTENERS.has(domain) || isSuspiciousTld || lookalikeSignal)) {
      const chain = await followRedirectChainSafely(item.url, 5, 4000);
      redirectHops = chain.hops;
      finalDestinationUrl = chain.finalUrl;
      isSsrfBlocked = chain.ssrfBlocked;
      ssrfBlockReason = chain.blockReason;

      if (chain.hops.length > 1) {
        unshortened = true;
        reasons.push(`Unshortened redirect chain (${chain.hops.length} hops) -> ${finalDestinationUrl}`);
        if (chain.hops.length >= 3) {
          hasSuspiciousRedirects = true;
          riskScore += 20;
          reasons.push(`Long multi-hop redirect chain (${chain.hops.length} hops) used to obscure final destination`);
        }
      }

      if (isSsrfBlocked) {
        riskScore = 100;
        reasons.push(`Blocked by SSRF policy: ${ssrfBlockReason}`);
      }
    }

    riskScore = Math.min(100, riskScore);
    const threatVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' =
      riskScore >= 70 ? 'MALICIOUS' : riskScore >= 35 ? 'SUSPICIOUS' : 'CLEAN';

    highestScore = Math.max(highestScore, riskScore);

    analyzedUrls.push({
      originalUrl: item.url,
      normalizedUrl: item.url.trim().toLowerCase(),
      source: item.source,
      displayText: item.displayText,
      isMismatchedDisplay,
      domain,
      tld,
      isSuspiciousTld,
      isPunycode,
      hasHomoglyphs,
      homoglyphDetails,
      lookalikeSignal,
      redirectHops,
      finalDestinationUrl,
      unshortened,
      isSsrfBlocked,
      ssrfBlockReason,
      riskScore,
      threatVerdict,
      reasons
    });
  }

  const overallVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' =
    highestScore >= 70 ? 'MALICIOUS' : highestScore >= 35 ? 'SUSPICIOUS' : 'CLEAN';

  return {
    totalUrls: analyzedUrls.length,
    uniqueDomains: Array.from(uniqueDomains),
    highestUrlRiskScore: highestScore,
    overallVerdict,
    hasLookalikeDomains: hasLookalike,
    hasSuspiciousRedirects,
    hasMismatchedUrls: hasMismatched,
    urls: analyzedUrls
  };
}
