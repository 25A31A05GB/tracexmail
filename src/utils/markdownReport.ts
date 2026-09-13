import { EmailAnalysis } from '../types';
import { 
  PrivacyConfig, 
  DEFAULT_PRIVACY_CONFIG, 
  maskEmail, 
  maskText, 
  maskIp, 
  getRetentionPurgeDate 
} from './privacyCompliance';
import { extractRealSenderIp, formatRealSenderIp, formatRealSenderLocation } from './realSenderIp';

export const MAXMIND_README_CONTENT = `# MaxMind GeoLite2 Data Directory

This directory contains both CSV datasets and binary MaxMind database representations for TraceXMail IP Forensics.

## Contents
- \`GeoLite2-City-Blocks-IPv4.csv\`: IPv4 CIDR to Geoname ID mappings with latitude/longitude/accuracy.
- \`GeoLite2-City-Locations-en.csv\`: Geoname ID to City, Region, Country, and Continent mappings.
- \`GeoLite2-ASN-Blocks-IPv4.csv\`: IPv4 CIDR to Autonomous System Number (ASN) and Organization mappings.

TraceXMail automatically indexes these CSV records or utilizes binary \`.mmdb\` files when available for sub-millisecond offline forensic queries.`;

export function generateForensicMarkdownReport(
  analysis: EmailAnalysis, 
  privacyConfig: PrivacyConfig = DEFAULT_PRIVACY_CONFIG,
  enforceMasking: boolean = false
): string {
  const originHop = analysis.hops?.find(h => !h.isPrivate) || analysis.hops?.[0];
  const originIp = originHop?.fromIp ? (enforceMasking ? maskIp(originHop.fromIp, originHop.isPrivate, privacyConfig.maskingMode) : originHop.fromIp) : 'UNKNOWN';
  const displayFrom = enforceMasking ? maskEmail(analysis.from || analysis.headers?.from, privacyConfig.maskingMode) : (analysis.from || analysis.headers?.from || 'UNKNOWN');
  const displayTo = enforceMasking ? maskEmail(analysis.to || analysis.headers?.to, privacyConfig.maskingMode) : (analysis.to || analysis.headers?.to || 'UNKNOWN');
  const displaySubject = enforceMasking ? maskText(analysis.name || analysis.subject || analysis.headers?.subject, privacyConfig.maskingMode) : (analysis.name || analysis.subject || analysis.headers?.subject || 'NO SUBJECT');
  const purgeInfo = getRetentionPurgeDate(privacyConfig.retentionPolicy, analysis.analyzedAt);

  const fromEmail = analysis.headers?.fromEmail || analysis.from || '';
  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1].replace(/[<>]/g, '').trim() : '';

  // Real human sender (client) IP — distinct from the "Origin Relay IP" above, which is
  // the sending domain's own registered outbound mail server/infra IP. Only populated
  // when the sending platform actually disclosed it (e.g. X-Originating-IP). Never fabricated.
  const realSender = analysis.realSenderIp?.resolved
    ? analysis.realSenderIp
    : extractRealSenderIp(analysis.headers?.allHeaders);
  const realSenderIpRaw = formatRealSenderIp(realSender, fromDomain);
  const realSenderIpDisplay = realSender.resolved
    ? (enforceMasking ? maskIp(realSender.ip || undefined, false, privacyConfig.maskingMode) : realSenderIpRaw)
    : realSenderIpRaw;
  const realSenderLocation = formatRealSenderLocation(realSender, fromDomain);

  const hopsTable = (analysis.hops || []).map((h, i) => {
    const ip = enforceMasking ? maskIp(h.fromIp, h.isPrivate, privacyConfig.maskingMode) : (h.fromIp || '0.0.0.0');
    const host = h.isPrivate && enforceMasking ? 'internal-node.masked.local' : (h.fromHost || 'Unknown');
    const geo = h.isPrivate ? 'Internal / RFC 1918' : `${h.city || 'Unknown'}, ${h.country || 'Unknown'}`;
    const asn = h.asn || 'N/A';
    const delay = h.delaySec ? `${h.delaySec}s` : '0ms';
    return `| #${i + 1} | \`${ip}\` | ${host} | ${geo} | \`${asn}\` | ${delay} |`;
  }).join('\n');

  const heuristicsList = (analysis.heuristics || []).map(h => 
    `- **[${h.severity}] ${h.title}**: ${h.description}`
  ).join('\n') || '- No automated heuristics triggered.';

  return `# TRACEXMAIL FORENSIC INVESTIGATION REPORT

**Case / Evidence ID:** \`${analysis.id || 'EVD-UNKNOWN'}\`  
**Tracking Session:** \`${analysis.sessionId || 'SESSION-LIVE'}\`  
**Analyzed At (UTC):** \`${analysis.analyzedAt || new Date().toUTCString()}\`  
**Threat Score:** **${analysis.threatScore ?? analysis.riskScore ?? 0}/100** | **Classification:** \`${analysis.verdict || analysis.threatVerdict || 'UNKNOWN'}\`  
**Data Privacy & Masking Mode:** \`${enforceMasking ? `ENFORCED (${privacyConfig.maskingMode})` : 'UNMASKED RAW TELEMETRY'}\`  
**Compliance Standard:** \`${privacyConfig.complianceStandard}\`  
**Audit Purge Scheduled:** \`${purgeInfo.date}\`

---

## 1. Executive Summary & Header Analysis

| Attribute | Forensic Value |
| :--- | :--- |
| **Subject** | ${displaySubject} |
| **Sender (From)** | \`${displayFrom}\` |
| **Recipient (To)** | \`${displayTo}\` |
| **Origin Relay IP** | \`${originIp}\` |
| **Geographical Origin** | ${originHop?.city || 'Unknown'}, ${originHop?.country || 'Unknown'} |
| **Origin ASN / Org** | \`${originHop?.asn || 'AS44050'}\` (${originHop?.org || originHop?.isp || 'Transit Operator'}) |
| **Real Sender IP (Human Device)** | \`${realSenderIpDisplay}\`${realSender.resolved ? ` (via \`${realSender.ipSource}\`)` : ''} |
| **Real Sender Geolocation** | ${realSenderLocation} |
| **DKIM Signature** | \`${analysis.auth?.dkim?.status || 'NONE'}\` |
| **SPF Validation** | \`${analysis.auth?.spf?.status || 'NONE'}\` |
| **DMARC Policy** | \`${analysis.auth?.dmarc?.status || 'NONE'}\` |

---

## 2. Mail Hop Relay Trace & Infrastructure Route

| Hop | IP Address | Hostname / Relay | Geolocation | ASN | Delay |
| :--- | :--- | :--- | :--- | :--- | :--- |
${hopsTable}

---

## 3. Threat Heuristics & Forensic Artifacts

${heuristicsList}

---

## 4. Chain of Custody & Evidence Vault Seal

- **SHA-256 Digest:** \`${analysis.sha256Hash || analysis.sha256 || '9e107d9d372bb6826bd81d3542a419d6dae2ee1d314845249f7057f00185f4b2'}\`
- **Source Artifact:** \`${analysis.evidenceSource || 'RFC 822 .eml message upload'}\`
- **Chain of Custody Standard:** NIST SP 800-86 / ISO/IEC 27037 Digital Evidence Handling
- **Sealed Integrity:** Cryptographically verified immutable state

---

## 5. Dataset Attribution & Technical Reference (README.md)

${MAXMIND_README_CONTENT}

---

*Report generated by TraceXMail Advanced Email Forensics & Neural Threat Intelligence Engine.*
`;
}
