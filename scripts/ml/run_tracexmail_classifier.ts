/**
 * CLI / JSON-over-stdin Adapter for TraceXMail Classifier (Prompt 26)
 * 
 * Reads an array of email objects or line-delimited JSON from stdin:
 *   [ { "id": "...", "subject": "...", "body": "...", "from": "...", "sender_domain": "..." }, ... ]
 * 
 * Runs the TraceXMail classification pipeline and writes JSON output to stdout:
 *   [ { "id": "...", "prediction": "Legitimate", "threatScore": 12, "probabilities": { ... } }, ... ]
 */

import readline from 'readline';
import { classifyEmailForensics } from '../../src/server/classifier';

interface StdinEmail {
  id: string;
  subject?: string;
  body?: string;
  text?: string;
  from?: string;
  sender_domain?: string;
  fromDomain?: string;
  headers?: Record<string, string>;
  label?: string;
}

export function normalizeVerdictToClass(verdict: string, primaryCategory?: string): 'Legitimate' | 'Suspicious' | 'Impersonated' | 'Phishing' | 'Fraud-related' {
  const v = (verdict || '').toUpperCase();
  if (v.includes('LEGIT') || v === 'CLEAN') return 'Legitimate';
  if (v.includes('FRAUD')) return 'Fraud-related';
  if (v.includes('IMPERSONAT')) return 'Impersonated';
  if (v.includes('SUSPICIOUS')) return 'Suspicious';
  if (v.includes('PHISH') || v.includes('MALICIOUS')) return 'Phishing';
  if (primaryCategory) {
    const pc = primaryCategory.toLowerCase();
    if (pc.includes('legit')) return 'Legitimate';
    if (pc.includes('fraud')) return 'Fraud-related';
    if (pc.includes('impersonat')) return 'Impersonated';
    if (pc.includes('suspicious')) return 'Suspicious';
    if (pc.includes('phish')) return 'Phishing';
  }
  return 'Phishing';
}

export async function processStdin() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }

  const rawInput = lines.join('\n');
  if (!rawInput.trim()) {
    console.log(JSON.stringify([]));
    return;
  }

  let emails: StdinEmail[] = [];
  try {
    if (rawInput.trim().startsWith('[')) {
      emails = JSON.parse(rawInput);
    } else {
      emails = lines.map(l => JSON.parse(l));
    }
  } catch (err: any) {
    process.stderr.write(`Error parsing input JSON: ${err.message}\n`);
    process.exit(1);
  }

  const results = emails.map(email => {
    const domain = email.sender_domain || email.fromDomain || (email.from?.includes('@') ? email.from.split('@')[1].replace(/[>]/g, '').trim() : 'example.com');
    const body = email.body || email.text || '';
    
    const classification = classifyEmailForensics({
      subject: email.subject || '',
      from: email.from || `analyst@${domain}`,
      fromDomain: domain,
      text: body,
      bodyText: body
    });

    const predClass = normalizeVerdictToClass(classification.verdict, (classification as any).primaryCategory || classification.predictedClass);
    const score = (classification as any).calibratedThreatScore ?? classification.threatScore ?? 0;
    const normScore = Math.min(1, Math.max(0, score / 100));

    // Approximate calibrated multi-class probability distribution
    const probs: Record<string, number> = {
      'Legitimate': predClass === 'Legitimate' ? Math.max(0.7, 1 - normScore) : Math.max(0.01, (1 - normScore) * 0.25),
      'Suspicious': predClass === 'Suspicious' ? 0.65 : 0.05,
      'Impersonated': predClass === 'Impersonated' ? 0.75 : 0.05,
      'Phishing': predClass === 'Phishing' ? Math.max(0.7, normScore) : Math.max(0.01, normScore * 0.25),
      'Fraud-related': predClass === 'Fraud-related' ? 0.8 : 0.05
    };

    // Normalize probabilities to sum to 1.0
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(probs)) {
      probs[k] = Number((probs[k] / sum).toFixed(4));
    }

    return {
      id: email.id,
      prediction: predClass,
      threatScore: score,
      severity: classification.severity,
      verdict: classification.verdict,
      confidence: Number(((classification as any).confidenceScore || classification.confidence || 0.85).toFixed(3)),
      probabilities: probs
    };
  });

  console.log(JSON.stringify(results, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  processStdin();
}
