import fs from 'fs';
import path from 'path';

/**
 * TraceXMail Design System Codemod: Palette Migration to D2 Homepage-Only Colors
 * Governed by Prompt 1c.
 *
 * Rewrites Tailwind arbitrary classes, inline styles, and SVG fill/stroke colors
 * to the exact D2 token palette:
 * - Surfaces: page #100e0c, section #14110d, card #171410, raised #1d1a15. Border #3a352c.
 * - Text: primary #ede6d8, secondary #b9af9c, muted #8e8574, inverse #100e0c.
 * - Gold: #c9a227 (hover #d8b035)
 * - Verified: green #22c55e (text #4ade80)
 * - Alert: red #b23a2e, text #ff8d7d (AA contrast)
 * - Anomaly: orange #fb923c (solid #f97316)
 * - Stone (Info): #b9af9c (replaces cyan/teal, violet/purple, blue, slate)
 */

export interface ColorReplacement {
  fromRegex: RegExp;
  to: string;
  description?: string;
}

// 1. Text color transformations (including red text -> #ff8d7d for 4.5:1 AA contrast)
const TEXT_REPLACEMENTS: ColorReplacement[] = [
  // Red text -> #ff8d7d
  { fromRegex: /text-\[#(?:b23a2e|c94a3d|ef4444|dc2626|e87063|ea4335|f87171|fca5a5|f1a39b)\]/gi, to: 'text-[#ff8d7d]' },
  // Cream / Primary text
  { fromRegex: /text-\[#(?:ffffff|faf7f2|f5f0e6|f4efe6|d6cebf)\]/gi, to: 'text-[#ede6d8]' },
  // Muted text
  { fromRegex: /text-\[#(?:8a8070|9d9282|9c9186|6b6254)\]/gi, to: 'text-[#8e8574]' },
  // Secondary text / Stone (including teal, violet, slate text becoming stone)
  { fromRegex: /text-\[#(?:94a3b8|7fa3ba|64748b|2dd4bf|14b8a6|06b6d4|319795|8c58b0|a855f7|c499e3|a975cf|3b82f6|60a5fa|38bdf8)\]/gi, to: 'text-[#b9af9c]' },
  // Green text
  { fromRegex: /text-\[#(?:48a975|10b981|34a853|16a34a|86efac)\]/gi, to: 'text-[#4ade80]' },
  // Orange anomaly text
  { fromRegex: /text-\[#(?:fed7aa|f59e0b|ea580c)\]/gi, to: 'text-[#fb923c]' },
  // Gold text
  { fromRegex: /text-\[#(?:dec052|eed885|d8b035|b5891e)\]/gi, to: 'text-[#c9a227]' },
];

// 2. Background color transformations
const BG_REPLACEMENTS: ColorReplacement[] = [
  // Page surface
  { fromRegex: /bg-\[#(?:0e0c0a|0b0d12|050b14|121820)\]/gi, to: 'bg-[#100e0c]' },
  // Section surface
  { fromRegex: /bg-\[#(?:14120f|13110e|16130f|181511|182330)\]/gi, to: 'bg-[#14110d]' },
  // Card surface
  { fromRegex: /bg-\[#(?:1a1712|1b1814|1f1a14|221e17|242019|24201a|26221b|28241c|2d261e|22364a)\]/gi, to: 'bg-[#171410]' },
  // Raised surface
  { fromRegex: /bg-\[#(?:2b251d|2f2a21|1c1813)\]/gi, to: 'bg-[#1d1a15]' },
  // Green background
  { fromRegex: /bg-\[#(?:48a975|10b981|34a853|16a34a|059669)\]/gi, to: 'bg-[#22c55e]' },
  // Orange anomaly background
  { fromRegex: /bg-\[#(?:f97316|ea580c|f59e0b)\]/gi, to: 'bg-[#fb923c]' },
  // Alert red background
  { fromRegex: /bg-\[#(?:c94a3d|ef4444|dc2626|e87063|ea4335)\]/gi, to: 'bg-[#b23a2e]' },
  // Teal/violet/blue/slate backgrounds to stone or card
  { fromRegex: /bg-\[#(?:2dd4bf|14b8a6|06b6d4|319795|8c58b0|a855f7|3b82f6|38bdf8)\]/gi, to: 'bg-[#171410]' },
];

// 3. Border color transformations
const BORDER_REPLACEMENTS: ColorReplacement[] = [
  // Default border
  { fromRegex: /border-\[#(?:332c23|2e2922|2d271f|28241d|262118|383025|4a4438|574f42|1b2b44|1b2b46)\]/gi, to: 'border-[#3a352c]' },
  // Green border
  { fromRegex: /border-\[#(?:48a975|10b981|34a853|275c3f)\]/gi, to: 'border-[#2e7a4a]' },
  // Orange anomaly border
  { fromRegex: /border-\[#(?:f97316|ea580c|f59e0b)\]/gi, to: 'border-[#9a3412]' },
  // Alert red border
  { fromRegex: /border-\[#(?:c94a3d|ef4444|dc2626|5a1e17)\]/gi, to: 'border-[#b23a2e]' },
  // Gold border
  { fromRegex: /border-\[#(?:dec052|eed885|d8b035)\]/gi, to: 'border-[#c9a227]' },
  // Teal/violet/blue/slate borders to stone default border
  { fromRegex: /border-\[#(?:2dd4bf|14b8a6|06b6d4|134e4a|8c58b0|a855f7|432a54|319795|3b82f6|38bdf8|7fa3ba)\]/gi, to: 'border-[#3a352c]' },
];

// 4. Raw string and style color replacements (non-Tailwind)
const RAW_COLOR_REPLACEMENTS: [string, string][] = [
  ['#14120f', '#100e0c'],
  ['#16130f', '#14110d'],
  ['#181511', '#14110d'],
  ['#1a1712', '#171410'],
  ['#1b1814', '#171410'],
  ['#221e17', '#171410'],
  ['#28241c', '#171410'],
  ['#2d261e', '#171410'],
  ['#24201a', '#171410'],
  ['#242019', '#171410'],
  ['#2b251d', '#1d1a15'],
  ['#2d271f', '#3a352c'],
  ['#2e2922', '#3a352c'],
  ['#332c23', '#3a352c'],
  ['#4a4438', '#3a352c'],
  ['#574f42', '#3a352c'],
  ['#48a975', '#22c55e'],
  ['#10b981', '#22c55e'],
  ['#8c58b0', '#b9af9c'], // violet to stone
  ['#2dd4bf', '#b9af9c'], // teal to stone
  ['#319795', '#b9af9c'],
  ['#7fa3ba', '#b9af9c'],
  ['#94a3b8', '#b9af9c'],
  ['#8a8070', '#8e8574'],
];

function transformContent(content: string, filePath: string): { newContent: string; changes: number } {
  // Preserve allowlisted brand identity colors in GoogleAuthButton and specific 3D canvases
  const isGoogleAuth = filePath.includes('GoogleAuthButton');
  const is3DCanvas = filePath.includes('/3d/');

  let modified = content;
  let totalChanges = 0;

  // 1. Run Text Replacements
  for (const { fromRegex, to } of TEXT_REPLACEMENTS) {
    const matches = modified.match(fromRegex);
    if (matches) {
      totalChanges += matches.length;
      modified = modified.replace(fromRegex, to);
    }
  }

  // 2. Run BG Replacements
  for (const { fromRegex, to } of BG_REPLACEMENTS) {
    const matches = modified.match(fromRegex);
    if (matches) {
      totalChanges += matches.length;
      modified = modified.replace(fromRegex, to);
    }
  }

  // 3. Run Border Replacements
  for (const { fromRegex, to } of BORDER_REPLACEMENTS) {
    const matches = modified.match(fromRegex);
    if (matches) {
      totalChanges += matches.length;
      modified = modified.replace(fromRegex, to);
    }
  }

  // 4. Raw Hex Replacements in inline styles (skip 3D and brand buttons)
  if (!isGoogleAuth && !is3DCanvas) {
    for (const [legacy, canonical] of RAW_COLOR_REPLACEMENTS) {
      const lower = legacy.toLowerCase();
      if (modified.toLowerCase().includes(lower)) {
        const regex = new RegExp(legacy, 'gi');
        const count = (modified.match(regex) || []).length;
        if (count > 0) {
          totalChanges += count;
          modified = modified.replace(regex, canonical);
        }
      }
    }
  }

  return { newContent: modified, changes: totalChanges };
}

function processDirectory(dir: string): { filesModified: number; totalReplacements: number } {
  let filesModified = 0;
  let totalReplacements = 0;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== '.git' &&
        entry.name !== '__tests__'
      ) {
        const sub = processDirectory(fullPath);
        filesModified += sub.filesModified;
        totalReplacements += sub.totalReplacements;
      }
    } else if (entry.isFile() && /\.(tsx?|css)$/.test(entry.name)) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const { newContent, changes } = transformContent(original, fullPath);
      if (changes > 0 && newContent !== original) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        filesModified++;
        totalReplacements += changes;
      }
    }
  }

  return { filesModified, totalReplacements };
}

export function runColorCodemod(): void {
  console.log('=== Starting TraceXMail D2 Color Palette Codemod ===');

  const targets = [
    path.resolve(process.cwd(), 'src/components/landing'),
    path.resolve(process.cwd(), 'src/components/common'),
    path.resolve(process.cwd(), 'src/components'),
    path.resolve(process.cwd(), 'src/features'),
  ].filter((p) => fs.existsSync(p));

  let totalFiles = 0;
  let totalChanges = 0;

  for (const target of targets) {
    const res = processDirectory(target);
    console.log(`Directory ${path.basename(target)}: ${res.filesModified} files updated, ${res.totalReplacements} color tokens migrated.`);
    totalFiles += res.filesModified;
    totalChanges += res.totalReplacements;
  }

  console.log(`\n✅ Codemod Complete: ${totalFiles} files rewritten, ${totalChanges} color occurrences migrated to D2 palette.`);
}

// Run if directly executed
runColorCodemod();
