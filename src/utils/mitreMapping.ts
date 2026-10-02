import { EmailAnalysis } from '../types';

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: 'Initial Access' | 'Execution' | 'Persistence' | 'Defense Evasion' | 'Credential Access' | 'Discovery' | 'Exfiltration' | 'Resource Development';
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedProof: string;
  url: string;
}

export function mapMitreAttackTechniques(analysis?: EmailAnalysis | null): MitreTechnique[] {
  if (!analysis) return [];

  const techniques: MitreTechnique[] = [];
  const heuristics = analysis.heuristics || [];
  const urls = analysis.urls || [];
  const attachments = analysis.attachments || [];
  const subject = (analysis.headers?.subject || analysis.subject || '').toLowerCase();
  const from = (analysis.headers?.from || analysis.from || '').toLowerCase();
  const spfStatus = (analysis.auth?.spf?.status || '').toUpperCase();
  const dkimStatus = (analysis.auth?.dkim?.status || '').toUpperCase();
  const dmarcStatus = (analysis.auth?.dmarc?.status || '').toUpperCase();

  // 1. T1566.002 - Spearphishing Link
  if (urls.length > 0 || heuristics.some(h => h.id?.includes('link') || h.id?.includes('url') || h.title?.toLowerCase().includes('link'))) {
    techniques.push({
      id: 'T1566.002',
      name: 'Spearphishing Link',
      tactic: 'Initial Access',
      description: 'Adversaries send spearphishing messages with a malicious link designed to direct victims to credential-harvesting pages or exploit payloads.',
      confidence: 'HIGH',
      detectedProof: `Found ${urls.length} link destination(s) in message body.`,
      url: 'https://attack.mitre.org/techniques/T1566/002/'
    });
  }

  // 2. T1566.001 - Spearphishing Attachment
  if (attachments.length > 0 || heuristics.some(h => h.id?.includes('att') || h.title?.toLowerCase().includes('attachment'))) {
    const isMal = attachments.some(a => a.status === 'MALICIOUS' || /\.(exe|iso|scr|vbs|bat|docm)$/i.test(a.filename));
    techniques.push({
      id: 'T1566.001',
      name: 'Spearphishing Attachment',
      tactic: 'Initial Access',
      description: 'Adversaries send spearphishing emails with malicious file attachments to gain initial code execution on target endpoints.',
      confidence: isMal ? 'HIGH' : 'MEDIUM',
      detectedProof: `Detected ${attachments.length} attachment artifact(s) (e.g., "${attachments[0]?.filename || 'file'}").`,
      url: 'https://attack.mitre.org/techniques/T1566/001/'
    });
  }

  // 3. T1598 - Phishing for Information (Credential Harvesting / Social Engineering)
  if (
    heuristics.some(h => h.id?.includes('cred') || h.id?.includes('urgency') || h.title?.toLowerCase().includes('credential')) ||
    /password|login|verify|account|suspend|payroll|wire|bank/i.test(subject)
  ) {
    techniques.push({
      id: 'T1598',
      name: 'Phishing for Information',
      tactic: 'Credential Access',
      description: 'Adversaries send deceptive communications with the intent of harvesting user credentials, multi-factor tokens, or sensitive enterprise data.',
      confidence: 'HIGH',
      detectedProof: `Lure keywords and social engineering urgency detected in message subject & headers.`,
      url: 'https://attack.mitre.org/techniques/T1598/'
    });
  }

  // 4. T1586.002 - Compromised Email Account / Mail Server
  if (spfStatus === 'FAIL' || dkimStatus === 'FAIL' || dmarcStatus === 'FAIL' || dmarcStatus === 'REJECT') {
    techniques.push({
      id: 'T1586.002',
      name: 'Compromised Email Infrastructure & Spoofing',
      tactic: 'Resource Development',
      description: 'Adversaries forge email sender identities or abuse open relays to bypass perimeter sender verification controls.',
      confidence: 'HIGH',
      detectedProof: `Cryptographic authentication failures: SPF (${spfStatus}), DKIM (${dkimStatus}), DMARC (${dmarcStatus}).`,
      url: 'https://attack.mitre.org/techniques/T1586/002/'
    });
  }

  // 5. T1564 - Hide Artifacts / Defense Evasion
  const isLookalike = Boolean(
    analysis.domain_intelligence?.is_typosquat ||
    heuristics.some(h => h.id?.includes('typo') || h.id?.includes('lookalike') || h.id?.includes('obfuscation'))
  );
  if (isLookalike || heuristics.some(h => h.title?.toLowerCase().includes('hidden') || h.title?.toLowerCase().includes('invisible'))) {
    techniques.push({
      id: 'T1564',
      name: 'Hide Artifacts & Lookalike Typosquatting',
      tactic: 'Defense Evasion',
      description: 'Adversaries utilize Unicode homoglyphs, typosquats, or zero-font techniques to blend with trusted brands and evade NLP filters.',
      confidence: 'HIGH',
      detectedProof: `Detected deceptive domain variation or header display-name diversion.`,
      url: 'https://attack.mitre.org/techniques/T1564/'
    });
  }

  // 6. T1656 - Impersonation
  if (from.includes('ceo') || from.includes('admin') || from.includes('security') || from.includes('support') || from.includes('paypal') || from.includes('microsoft')) {
    techniques.push({
      id: 'T1656',
      name: 'Impersonation (VIP / Brand Pretext)',
      tactic: 'Defense Evasion',
      description: 'Adversaries impersonate a trusted entity or executive to induce victims into compliance with deceptive instructions.',
      confidence: 'MEDIUM',
      detectedProof: `Display name or sender address leverages high-trust authority pretext ("${from.substring(0, 45)}").`,
      url: 'https://attack.mitre.org/techniques/T1656/'
    });
  }

  return techniques;
}
