import fs from 'fs';
import path from 'path';

interface Finding {
  file: string;
  line: number;
  rule: string;
  match: string;
}

const SECRET_PATTERNS: { rule: string; regex: RegExp }[] = [
  { rule: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: 'Slack Token', regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g },
  { rule: 'Google API Key', regex: /\bAIza[0-9A-Za-z\\-_]{35}\b/g },
  { rule: 'Private Key Header', regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP)? PRIVATE KEY-----/g },
  { rule: 'GitHub Personal Access Token', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/g },
  { rule: 'High Entropy Generic Secret assignment', regex: /(?:api_key|apiKey|secret|password|token)\s*[:=]\s*["']([A-Za-z0-9+/=_-]{32,})["']/gi }
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  '.env.example',
  'package-lock.json',
  'bun.lock',
  'tests',
  '__tests__',
  'reports',
  'docs'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORED_PATHS.some(ignored => filePath.includes(ignored) || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg'));
}

export function scanDirectory(dir: string, findings: Finding[] = []): Finding[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;

    if (entry.isDirectory()) {
      scanDirectory(fullPath, findings);
    } else if (entry.isFile()) {
      scanFile(fullPath, findings);
    }
  }

  return findings;
}

export function scanFile(filePath: string, findings: Finding[] = []): Finding[] {
  if (shouldIgnore(filePath)) return findings;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip commented mock examples or obvious placeholders
      if (line.includes('example') || line.includes('placeholder') || line.includes('test-') || line.includes('dummy')) {
        return;
      }

      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          findings.push({
            file: filePath,
            line: index + 1,
            rule: pattern.rule,
            match: match[0].slice(0, 10) + '...'
          });
        }
      }
    });
  } catch {
    // Ignore binary or unreadable files
  }

  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = scanDirectory(process.cwd());
  if (findings.length > 0) {
    console.error(`🚨 Security scan failed! Detected ${findings.length} potential secrets:`);
    findings.forEach(f => {
      console.error(` - [${f.rule}] in ${f.file}:${f.line} (${f.match})`);
    });
    process.exit(1);
  } else {
    console.log('✅ Secret scan clean: No hardcoded secrets detected.');
    process.exit(0);
  }
}
