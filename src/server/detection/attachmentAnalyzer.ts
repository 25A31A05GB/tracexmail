import crypto from 'crypto';
import path from 'path';
import { encryptSecret, decryptSecret } from '../crypto/encryption';
import { logger } from '../logger';

export interface AttachmentMetadata {
  filename: string;
  declaredMimeType: string;
  sizeBytes: number;
  sha256: string;
  md5: string;
}

export interface AttachmentVerdict {
  metadata: AttachmentMetadata;
  detectedType: string;
  isDangerous: boolean;
  hasDoubleExtension: boolean;
  hasMacros: boolean;
  isHtmlSmuggling: boolean;
  isEncryptedArchive: boolean;
  isExecutable: boolean;
  isDiskImage: boolean;
  isLnkShortcut: boolean;
  magicByteMismatch: boolean;
  virusTotalHit?: {
    positives: number;
    total: number;
    permalink?: string;
  };
  sandboxResult?: {
    status: 'skipped' | 'submitted' | 'completed' | 'failed';
    score?: number;
    detonationNotes?: string;
  };
  threatScore: number; // 0 to 100
  threatVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  reasons: string[];
  storedEncryptedKey?: string;
}

export interface AttachmentAnalysisReport {
  totalAttachments: number;
  hasDangerousAttachments: boolean;
  hasMacroFiles: boolean;
  hasHtmlSmuggling: boolean;
  highestRiskScore: number;
  overallVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  attachments: AttachmentVerdict[];
}

/**
 * Pluggable SandboxProvider interface for external detonation services.
 */
export interface SandboxProvider {
  name: string;
  isEnabled(): boolean;
  submitSample(buffer: Buffer, filename: string): Promise<{ submissionId: string; status: string }>;
  checkStatus(submissionId: string): Promise<{ status: string; score?: number; reportUrl?: string }>;
}

export class DisabledSandboxProvider implements SandboxProvider {
  public readonly name = 'disabled_stub';
  isEnabled(): boolean {
    return false;
  }
  async submitSample(): Promise<{ submissionId: string; status: string }> {
    return { submissionId: 'none', status: 'skipped_disabled' };
  }
  async checkStatus(): Promise<{ status: string }> {
    return { status: 'disabled' };
  }
}

let activeSandboxProvider: SandboxProvider = new DisabledSandboxProvider();

export function setSandboxProvider(provider: SandboxProvider) {
  activeSandboxProvider = provider;
}

export function getSandboxProvider(): SandboxProvider {
  return activeSandboxProvider;
}

/**
 * In-memory LRU-style cache for VirusTotal hash lookups.
 */
const VT_HASH_CACHE = new Map<string, { positives: number; total: number; permalink?: string; cachedAt: number }>();
const VT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Checks VirusTotal by SHA-256 hash (never uploading attachment bytes).
 */
export async function lookupVirusTotalByHash(
  sha256: string
): Promise<{ positives: number; total: number; permalink?: string } | undefined> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return undefined;
  }

  const cached = VT_HASH_CACHE.get(sha256);
  if (cached && Date.now() - cached.cachedAt < VT_CACHE_TTL_MS) {
    return { positives: cached.positives, total: cached.total, permalink: cached.permalink };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { 'x-apikey': apiKey },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      // Hash unknown to VT
      return undefined;
    }

    if (!res.ok) {
      logger.warn({ status: res.status }, 'VirusTotal hash lookup non-200');
      return undefined;
    }

    const data: any = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const positives: number = Number((stats.malicious || 0) + (stats.suspicious || 0));
    const total: number = Number(Object.values(stats).reduce((acc: number, v: any) => acc + (typeof v === 'number' ? v : 0), 0)) || 70;
    const permalink = `https://www.virustotal.com/gui/file/${sha256}`;

    const result = { positives, total, permalink };
    VT_HASH_CACHE.set(sha256, { ...result, cachedAt: Date.now() });
    return result;
  } catch (err: any) {
    logger.warn({ error: err.message }, 'VirusTotal hash lookup failed or timed out');
    return undefined;
  }
}

/**
 * Inspects magic bytes to detect file types independently of extensions.
 */
export function identifyMagicBytes(buf: Buffer): { type: string; mimeType: string; isExecutable: boolean } {
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) {
    return { type: 'Windows Executable / DLL (MZ/PE)', mimeType: 'application/x-msdownload', isExecutable: true };
  }
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
    return { type: 'Linux Executable (ELF)', mimeType: 'application/x-executable', isExecutable: true };
  }
  if (buf.length >= 4 && ((buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && (buf[3] === 0xce || buf[3] === 0xcf)) || (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe))) {
    return { type: 'macOS Mach-O Binary', mimeType: 'application/x-mach-binary', isExecutable: true };
  }
  if (buf.length >= 4 && buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe) {
    return { type: 'Java Class File', mimeType: 'application/java-vm', isExecutable: true };
  }
  if (buf.length >= 4 && buf[0] === 0x4c && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x00 && buf[4] === 0x01 && buf[5] === 0x14 && buf[6] === 0x02 && buf[7] === 0x00) {
    return { type: 'Windows Shortcut (LNK)', mimeType: 'application/x-ms-shortcut', isExecutable: true };
  }
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 && buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1) {
    return { type: 'Legacy Microsoft Compound Document (OLE2/DOC/XLS)', mimeType: 'application/x-ole-storage', isExecutable: false };
  }
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    return { type: 'ZIP / Office OOXML Archive (PK)', mimeType: 'application/zip', isExecutable: false };
  }
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return { type: 'Adobe PDF', mimeType: 'application/pdf', isExecutable: false };
  }
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('ascii').toLowerCase() === '<html>' || buf.subarray(0, 14).toString('ascii').toLowerCase().includes('<!doctype html'))) {
    return { type: 'HTML Document', mimeType: 'text/html', isExecutable: false };
  }
  return { type: 'Binary Data / Unknown', mimeType: 'application/octet-stream', isExecutable: false };
}

/**
 * Checks for ISO / IMG disk image headers.
 */
export function checkDiskImageMagic(buf: Buffer): boolean {
  // ISO-9660 signatures at offset 0x8000, 0x8800, 0x9000
  const offsets = [0x8000, 0x8800, 0x9000];
  for (const off of offsets) {
    if (buf.length >= off + 6) {
      const sig = buf.subarray(off + 1, off + 6).toString('ascii');
      if (sig === 'CD001' || sig === 'BEA01') return true;
    }
  }
  return false;
}

/**
 * Scans Office documents (OOXML ZIP or OLE2) for embedded VBA macros.
 */
export function scanOfficeMacros(buf: Buffer): boolean {
  // 1. Check OOXML ZIP archive for vbaProject.bin
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    const rawAscii = buf.toString('latin1');
    if (rawAscii.includes('vbaProject.bin') || rawAscii.includes('word/vbaProject') || rawAscii.includes('xl/vbaProject')) {
      return true;
    }
  }

  // 2. Check OLE2 compound document stream names
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    const rawAscii = buf.toString('latin1');
    if (
      rawAscii.includes('_VBA_PROJECT_CUR') ||
      rawAscii.includes('VBA') ||
      rawAscii.includes('dir') ||
      rawAscii.includes('Sub AutoOpen') ||
      rawAscii.includes('Sub Auto_Open') ||
      rawAscii.includes('Sub Workbook_Open')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Detects HTML smuggling payloads in HTML or SVG content.
 */
export function scanHtmlSmuggling(buf: Buffer): { isSmuggling: boolean; reasons: string[] } {
  const content = buf.toString('utf8').slice(0, 200000); // Check first 200KB
  const reasons: string[] = [];

  const hasBlob = /new\s+Blob\s*\(/i.test(content) || /window\.Blob/i.test(content);
  const hasUrlCreate = /URL\.createObjectURL\s*\(/i.test(content) || /webkitURL\.createObjectURL/i.test(content);
  const hasMsSave = /msSaveOrOpenBlob/i.test(content) || /msSaveBlob/i.test(content);
  const hasDownloadAttr = /download\s*=\s*["'][^"']+\.(exe|iso|vbs|bat|ps1|js|cmd|scr|zip|7z)["']/i.test(content);
  const hasBase64Exec = /data:application\/(octet-stream|x-msdownload|x-executable|zip);base64/i.test(content);

  if (hasBlob && (hasUrlCreate || hasMsSave)) {
    reasons.push('JavaScript Blob creation paired with object URL generation to construct in-memory file download');
  }
  if (hasDownloadAttr) {
    reasons.push('HTML anchor with explicit download attribute for executable or archive file');
  }
  if (hasBase64Exec) {
    reasons.push('Embedded Base64 encoded executable payload inside HTML document');
  }

  return {
    isSmuggling: reasons.length > 0,
    reasons
  };
}

/**
 * Checks if a ZIP or archive is password protected.
 */
export function checkEncryptedArchive(buf: Buffer): boolean {
  if (buf.length >= 8 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // General purpose bit flag is at offset 6 (2 bytes, little-endian)
    const bitFlag = buf.readUInt16LE(6);
    // Bit 0 = 1 if the file is encrypted
    if ((bitFlag & 0x0001) !== 0) {
      return true;
    }
  }
  // RAR 5.0 encrypted header
  if (buf.length >= 8 && buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21 && buf[4] === 0x1a && buf[5] === 0x07 && buf[6] === 0x01) {
    return true;
  }
  return false;
}

/**
 * Detects dangerous double extensions (e.g. invoice.pdf.exe).
 */
export function checkDoubleExtension(filename: string): { isDouble: boolean; realExt: string; spoofedExt: string } {
  const parts = filename.toLowerCase().split('.').filter(Boolean);
  if (parts.length >= 3) {
    const realExt = parts[parts.length - 1];
    const spoofedExt = parts[parts.length - 2];
    const docExtensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'txt', 'csv', 'jpg', 'png'];
    const execExtensions = ['exe', 'vbs', 'vbe', 'bat', 'cmd', 'ps1', 'js', 'jse', 'wsf', 'wsh', 'scr', 'hta', 'pif', 'com', 'iso', 'lnk'];

    if (docExtensions.includes(spoofedExt) && execExtensions.includes(realExt)) {
      return { isDouble: true, realExt, spoofedExt };
    }
  }
  return { isDouble: false, realExt: '', spoofedExt: '' };
}

/**
 * Main attachment forensic analyzer.
 * Adheres to the SAFE-HANDLING RULE: Attachments are never executed or opened;
 * they are encrypted at rest with AES-256-GCM, and only metadata & SHA-256 are shown in the UI.
 */
export async function analyzeAttachment(
  filename: string,
  buffer: Buffer,
  declaredMimeType: string = 'application/octet-stream'
): Promise<AttachmentVerdict> {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');
  const sizeBytes = buffer.length;

  const metadata: AttachmentMetadata = {
    filename,
    declaredMimeType,
    sizeBytes,
    sha256,
    md5
  };

  const reasons: string[] = [];
  let threatScore = 0;

  // 1. Safe-Handling Rule: encrypt sample before persisting
  let storedEncryptedKey: string | undefined;
  try {
    const encrypted = encryptSecret(buffer.toString('base64'));
    storedEncryptedKey = encrypted;
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to encrypt attachment sample at rest');
  }

  // 2. Identify real type via magic bytes
  const magic = identifyMagicBytes(buffer);
  const isDiskImage = checkDiskImageMagic(buffer);
  const isLnkShortcut = magic.type.includes('LNK');
  const isExecutable = magic.isExecutable;

  // Check magic-byte vs extension mismatch
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  let magicByteMismatch = false;
  if (isExecutable && ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'txt'].includes(ext)) {
    magicByteMismatch = true;
    threatScore += 50;
    reasons.push(`Executable binary masquerading as a non-executable .${ext} document (Magic bytes: ${magic.type})`);
  }

  // 3. Double extension check
  const doubleExt = checkDoubleExtension(filename);
  if (doubleExt.isDouble) {
    threatScore += 45;
    reasons.push(`Deceptive double extension detected: disguised as .${doubleExt.spoofedExt} but executed as .${doubleExt.realExt}`);
  }

  // 4. Macro detection in Office docs
  const hasMacros = scanOfficeMacros(buffer);
  if (hasMacros) {
    threatScore += 35;
    reasons.push('VBA macros detected in Office document (common vector for credential stealing & trojan downloaders)');
  }

  // 5. HTML Smuggling detection
  const htmlSmuggle = scanHtmlSmuggling(buffer);
  const isHtmlSmuggling = htmlSmuggle.isSmuggling;
  if (isHtmlSmuggling) {
    threatScore += 40;
    for (const r of htmlSmuggle.reasons) {
      reasons.push(`HTML Smuggling: ${r}`);
    }
  }

  // 6. Encrypted archive detection
  const isEncryptedArchive = checkEncryptedArchive(buffer);
  if (isEncryptedArchive) {
    threatScore += 25;
    reasons.push('Password-protected encrypted archive designed to evade automated gateway virus scanning');
  }

  if (isDiskImage) {
    threatScore += 35;
    reasons.push('ISO/IMG disk image container used to bypass Mark-of-the-Web (MOTW) security controls');
  }

  if (isLnkShortcut) {
    threatScore += 40;
    reasons.push('Windows LNK shortcut file containing potentially malicious command line arguments');
  }

  // 7. VirusTotal hash lookup
  const vtResult = await lookupVirusTotalByHash(sha256);
  if (vtResult && vtResult.positives > 0) {
    const vtScore = Math.min(60, vtResult.positives * 5);
    threatScore += vtScore;
    reasons.push(`VirusTotal detection: flagged by ${vtResult.positives}/${vtResult.total} security vendors`);
  }

  // 8. Pluggable Sandbox interface
  let sandboxResult: AttachmentVerdict['sandboxResult'];
  if (activeSandboxProvider.isEnabled()) {
    try {
      const sub = await activeSandboxProvider.submitSample(buffer, filename);
      sandboxResult = { status: sub.status as any, detonationNotes: `Submission ID: ${sub.submissionId}` };
    } catch (e: any) {
      sandboxResult = { status: 'failed', detonationNotes: e.message };
    }
  } else {
    sandboxResult = { status: 'skipped', detonationNotes: 'External detonation sandbox disabled by default' };
  }

  threatScore = Math.min(100, threatScore);
  const threatVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' =
    threatScore >= 65 ? 'MALICIOUS' : threatScore >= 30 ? 'SUSPICIOUS' : 'CLEAN';

  const isDangerous =
    isExecutable ||
    doubleExt.isDouble ||
    hasMacros ||
    isHtmlSmuggling ||
    isDiskImage ||
    isLnkShortcut ||
    magicByteMismatch ||
    (vtResult ? vtResult.positives >= 3 : false);

  return {
    metadata,
    detectedType: isDiskImage ? 'ISO/IMG Disk Image' : magic.type,
    isDangerous,
    hasDoubleExtension: doubleExt.isDouble,
    hasMacros,
    isHtmlSmuggling,
    isEncryptedArchive,
    isExecutable,
    isDiskImage,
    isLnkShortcut,
    magicByteMismatch,
    virusTotalHit: vtResult,
    sandboxResult,
    threatScore,
    threatVerdict,
    reasons,
    storedEncryptedKey
  };
}

/**
 * Analyzes multiple attachments and computes roll-up verdict.
 */
export async function analyzeAttachmentsList(
  attachments: Array<{ filename: string; buffer: Buffer; declaredMimeType?: string }>
): Promise<AttachmentAnalysisReport> {
  const results: AttachmentVerdict[] = [];
  let highestRisk = 0;
  let hasDangerous = false;
  let hasMacros = false;
  let hasHtml = false;

  for (const att of attachments) {
    const verdict = await analyzeAttachment(att.filename, att.buffer, att.declaredMimeType);
    results.push(verdict);
    highestRisk = Math.max(highestRisk, verdict.threatScore);
    if (verdict.isDangerous) hasDangerous = true;
    if (verdict.hasMacros) hasMacros = true;
    if (verdict.isHtmlSmuggling) hasHtml = true;
  }

  const overallVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' =
    highestRisk >= 65 ? 'MALICIOUS' : highestRisk >= 30 ? 'SUSPICIOUS' : 'CLEAN';

  return {
    totalAttachments: results.length,
    hasDangerousAttachments: hasDangerous,
    hasMacroFiles: hasMacros,
    hasHtmlSmuggling: hasHtml,
    highestRiskScore: highestRisk,
    overallVerdict,
    attachments: results
  };
}
