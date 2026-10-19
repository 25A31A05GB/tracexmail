import fs from 'fs';
import path from 'path';

function flattenKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(flattenKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

if (!fs.existsSync(EN_PATH)) {
  console.error(`[Locale CI Check] Fatal: en.json ground truth not found at ${EN_PATH}`);
  process.exit(1);
}

const enContent = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const enKeys = new Set(flattenKeys(enContent));

console.log(`[Locale CI Check] Ground truth 'en.json' contains ${enKeys.size} translation keys.`);

const targetLocales = ['hi', 'es', 'fr', 'de', 'pt', 'ar'];
let hasErrors = false;

for (const lang of targetLocales) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`[Locale CI Check] FAIL: Missing locale file for '${lang}' at ${filePath}`);
    hasErrors = true;
    continue;
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const langKeys = new Set(flattenKeys(content));

  const missingFromLang: string[] = [];
  for (const k of enKeys) {
    if (!langKeys.has(k)) {
      missingFromLang.push(k);
    }
  }

  const extraInLang: string[] = [];
  for (const k of langKeys) {
    if (!enKeys.has(k)) {
      extraInLang.push(k);
    }
  }

  if (missingFromLang.length > 0) {
    console.error(`[Locale CI Check] FAIL: '${lang}.json' is missing ${missingFromLang.length} key(s):`);
    missingFromLang.forEach((k) => console.error(`   - ${k}`));
    hasErrors = true;
  } else {
    console.log(`[Locale CI Check] PASS: '${lang}.json' has 100% key parity with en.json (${langKeys.size} keys).`);
  }

  if (extraInLang.length > 0) {
    console.warn(`[Locale CI Check] WARN: '${lang}.json' has ${extraInLang.length} unused/extra key(s):`);
    extraInLang.forEach((k) => console.warn(`   + ${k}`));
  }
}

if (hasErrors) {
  console.error('\n[Locale CI Check] Process failed: Locale key synchronization check failed.');
  process.exit(1);
} else {
  console.log('\n[Locale CI Check] All locale files passed parity verification.');
  process.exit(0);
}
