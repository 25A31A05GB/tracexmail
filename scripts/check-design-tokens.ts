import fs from 'fs';
import path from 'path';

/**
 * TraceXMail Design Token & Anti-Arbitrary Value CI Checker
 *
 * Enforces Prompt 1 & Design Prompt D rules:
 * 1. Fails the build on new hard-coded hex colors or arbitrary Tailwind values
 *    like text-[#...] or w-[13px] outside src/design-system.
 * 2. Uses scripts/design-token-allowlist.json to enforce strict decreasing budgets.
 */

interface AllowlistConfig {
  description: string;
  permanentExceptions: string[];
  migrationFileBudgets: Record<string, {
    maxHexViolations: number;
    maxArbitraryTailwindViolations: number;
  }>;
}

const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3,8})\b/g;
const ARBITRARY_TW_REGEX = /\b(?:w|h|p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|text|bg|border|rounded|top|bottom|left|right|gap|inset)-\[(?!var\(--)[^\]]+\]/g;

const ALLOWLIST_PATH = path.resolve(process.cwd(), 'scripts/design-token-allowlist.json');

function loadAllowlist(): AllowlistConfig {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    throw new Error(`Missing allowlist file at ${ALLOWLIST_PATH}`);
  }
  return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'design-system' && file !== '__tests__' && file !== '.git') {
        results = results.concat(walkDir(fullPath));
      }
    } else {
      if (/\.(tsx?|css)$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function runDesignTokenCheck(): { success: boolean; errors: string[]; stats: { totalFiles: number; totalHex: number; totalTw: number } } {
  const allowlist = loadAllowlist();
  const permSet = new Set(allowlist.permanentExceptions.map((hex) => hex.toLowerCase()));

  const files = walkDir('src');
  const errors: string[] = [];
  let totalHex = 0;
  let totalTw = 0;

  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let fileHexCount = 0;
    let fileTwCount = 0;
    const lineViolations: string[] = [];

    lines.forEach((line, index) => {
      // Skip CSS custom properties definition or URL anchors or sha256 lines
      if (line.includes('--') || line.includes('href="#') || line.includes('id="') || line.includes('sha256')) {
        return;
      }

      let hexMatch: RegExpExecArray | null;
      while ((hexMatch = HEX_COLOR_REGEX.exec(line)) !== null) {
        const hex = hexMatch[0].toLowerCase();
        if (!permSet.has(hex)) {
          fileHexCount++;
          lineViolations.push(`  L${index + 1}: hard-coded hex "${hexMatch[0]}"`);
        }
      }

      let twMatch: RegExpExecArray | null;
      while ((twMatch = ARBITRARY_TW_REGEX.exec(line)) !== null) {
        fileTwCount++;
        lineViolations.push(`  L${index + 1}: arbitrary Tailwind value "${twMatch[0]}"`);
      }
    });

    totalHex += fileHexCount;
    totalTw += fileTwCount;

    const budget = allowlist.migrationFileBudgets[relativePath];
    if (!budget) {
      if (fileHexCount > 0 || fileTwCount > 0) {
        errors.push(
          `[FAIL] ${relativePath} is not in the allowlist but contains design violations (${fileHexCount} hex, ${fileTwCount} arbitrary):\n` +
          lineViolations.slice(0, 10).join('\n') +
          (lineViolations.length > 10 ? `\n  ... and ${lineViolations.length - 10} more` : '')
        );
      }
    } else {
      if (fileHexCount > budget.maxHexViolations) {
        errors.push(
          `[FAIL] ${relativePath} exceeded hex violation budget! Allowed: ${budget.maxHexViolations}, found: ${fileHexCount}.`
        );
      }
      if (fileTwCount > budget.maxArbitraryTailwindViolations) {
        errors.push(
          `[FAIL] ${relativePath} exceeded arbitrary Tailwind violation budget! Allowed: ${budget.maxArbitraryTailwindViolations}, found: ${fileTwCount}.`
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
    stats: {
      totalFiles: files.length,
      totalHex,
      totalTw,
    },
  };
}

// Direct execution CLI
const result = runDesignTokenCheck();
console.log('--- TraceXMail Design Token Verification ---');
console.log(`Files scanned: ${result.stats.totalFiles}`);
console.log(`Active legacy hex occurrences: ${result.stats.totalHex}`);
console.log(`Active legacy arbitrary Tailwind values: ${result.stats.totalTw}`);

if (!result.success) {
  console.error('\n❌ Design token check failed with violations:');
  result.errors.forEach((err) => console.error(err));
  process.exit(1);
} else {
  console.log('\n✅ All design token budgets and enforcement checks passed successfully.');
  process.exit(0);
}
