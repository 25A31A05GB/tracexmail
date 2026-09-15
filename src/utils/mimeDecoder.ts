import { sha256Sync, md5Sync } from './crypto';

/**
 * Decodes Quoted-Printable bytes into a Uint8Array.
 */
export function decodeQuotedPrintableToBuffer(input: string, isQHeader = false): Buffer {
  if (!input) return Buffer.alloc(0);
  let str = input.replace(/=\r?\n/g, '');
  if (isQHeader) {
    str = str.replace(/_/g, ' ');
  }

  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '=' && i + 2 < str.length) {
      const hex = str.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes);
}

/**
 * Decodes RFC 2047 encoded-words in email headers (e.g. `=?UTF-8?Q?...?=` or `=?UTF-8?B?...?=`).
 * Safely handles plain text strings, multi-byte UTF-8 emojis, and multi-word sequences.
 */
export function decodeHeaderWords(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed.includes('=?')) return trimmed;

  return trimmed.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_match, charset, encoding, data) => {
    try {
      const enc = encoding.toUpperCase();
      if (enc === 'B') {
        const cleaned = data.replace(/\s+/g, '');
        // 1. Try modern TextDecoder with Uint8Array binary decode (works in browser & node)
        try {
          if (typeof atob === 'function') {
            const binary = atob(cleaned);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return new TextDecoder(charset || 'utf-8').decode(bytes);
          }
        } catch {}

        // 2. Node Buffer fallback
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(cleaned, 'base64').toString('utf-8');
        }
      } else if (enc === 'Q') {
        const buf = decodeQuotedPrintableToBuffer(data, true);
        return buf.toString('utf-8');
      }
    } catch {
      // return match as-is on failure
    }
    return _match;
  });
}

/**
 * Decodes quoted-printable string content into UTF-8.
 */
export function decodeQuotedPrintable(input: string): string {
  if (!input) return '';
  try {
    const buf = decodeQuotedPrintableToBuffer(input, false);
    return buf.toString('utf-8');
  } catch {
    return input
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}

/**
 * Decodes base64 content into UTF-8 string or Buffer.
 */
export function decodeBase64(input: string): string {
  if (!input) return '';
  try {
    const cleaned = input.replace(/\s+/g, '');
    return Buffer.from(cleaned, 'base64').toString('utf-8');
  } catch {
    return input;
  }
}

/**
 * Decodes email body according to Content-Transfer-Encoding.
 */
export function decodeBodyContent(body: string, transferEncoding?: string): string {
  if (!body) return '';
  const enc = (transferEncoding || '').toLowerCase().trim();
  if (enc === 'quoted-printable') {
    return decodeQuotedPrintable(body);
  }
  if (enc === 'base64') {
    return decodeBase64(body);
  }
  return body;
}

export interface DecodedMimeAttachment {
  filename: string;
  mimeType: string;
  size: string;
  sizeBytes: number;
  sha256: string;
  md5: string;
  isDangerous: boolean;
  rawBuffer?: Buffer;
}

export interface DecodedMimeStructure {
  decodedBodyText: string;
  decodedHtmlText: string;
  attachments: DecodedMimeAttachment[];
}

/**
 * Extracts boundary string from Content-Type header.
 */
export function extractBoundary(contentType?: string): string | null {
  if (!contentType) return null;
  const match = contentType.match(/boundary=["']?([^"';\r\n]+)["']?/i);
  return match ? match[1].trim() : null;
}

/**
 * Safely parses MIME structure and extracts genuine attachments strictly from MIME part headers.
 * Never runs loose whole-body regexes that mistake QP `name=3D"..."` for attachment filenames.
 */
export function parseMimeStructure(rawContent: string, globalContentType?: string): DecodedMimeStructure {
  const result: DecodedMimeStructure = {
    decodedBodyText: '',
    decodedHtmlText: '',
    attachments: []
  };

  if (!rawContent) return result;

  // Split headers and body of message
  const headerEndMatch = rawContent.match(/\r?\n\r?\n/);
  if (!headerEndMatch) {
    result.decodedBodyText = rawContent;
    return result;
  }

  const headerSection = rawContent.slice(0, headerEndMatch.index);
  const bodySection = rawContent.slice((headerEndMatch.index || 0) + headerEndMatch[0].length);

  // Determine top-level content type and boundary
  let cType = globalContentType;
  if (!cType) {
    const ctMatch = headerSection.match(/^Content-Type:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/im);
    if (ctMatch) cType = ctMatch[1];
  }

  const boundary = extractBoundary(cType);

  if (boundary) {
    // Multipart MIME structure
    const boundaryDelimiter = `--${boundary}`;
    const rawParts = bodySection.split(boundaryDelimiter);

    for (const rawPart of rawParts) {
      const trimmedPart = rawPart.trim();
      if (!trimmedPart || trimmedPart === '--') continue;

      const partHeaderEnd = rawPart.match(/\r?\n\r?\n/);
      if (!partHeaderEnd) continue;

      const partHeaders = rawPart.slice(0, partHeaderEnd.index);
      const partBody = rawPart.slice((partHeaderEnd.index || 0) + partHeaderEnd[0].length);

      const partCtMatch = partHeaders.match(/Content-Type:\s*([^\r\n;]+)/i);
      const partMimeType = partCtMatch ? partCtMatch[1].trim().toLowerCase() : 'text/plain';

      const partEncMatch = partHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n;]+)/i);
      const partEncoding = partEncMatch ? partEncMatch[1].trim().toLowerCase() : '7bit';

      const partDispMatch = partHeaders.match(/Content-Disposition:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
      const partDisposition = partDispMatch ? partDispMatch[1].trim() : '';

      // Check if this part is an attachment
      // Must have Content-Disposition: attachment OR explicit filename/name in part headers
      let filename: string | null = null;
      const fnMatch = partHeaders.match(/(?:filename|name)\*?=["']?([^"';\r\n]+)["']?/i);
      if (fnMatch) {
        filename = decodeHeaderWords(fnMatch[1].trim());
      }

      const isExplicitAttachment = /attachment/i.test(partDisposition) || (Boolean(filename) && !partMimeType.startsWith('text/'));

      if (isExplicitAttachment && filename) {
        // Clean QP artifacts if any
        if (filename.startsWith('3D') || filename.startsWith('=3D')) {
          filename = filename.replace(/^=?3D["']?/, '').replace(/["']?$/, '');
        }

        if (filename && filename !== '3D') {
          let partBuf: Buffer;
          if (partEncoding === 'base64') {
            partBuf = Buffer.from(partBody.replace(/\s+/g, ''), 'base64');
          } else if (partEncoding === 'quoted-printable') {
            partBuf = decodeQuotedPrintableToBuffer(partBody);
          } else {
            partBuf = Buffer.from(partBody, 'utf-8');
          }

          const sizeBytes = partBuf.length;
          const sizeKb = (sizeBytes / 1024).toFixed(1);
          const sha256 = sha256Sync(partBuf);
          const md5 = md5Sync(partBuf);
          const isExe = /\.(exe|scr|bat|vbs|hta|js|jar|iso|vbe|wsf|dll|pif)$/i.test(filename);
          const isMacro = /\.(docm|xlsm|pptm|dotm|xltm)$/i.test(filename);

          result.attachments.push({
            filename,
            mimeType: partMimeType,
            size: `${sizeKb} KB`,
            sizeBytes,
            sha256,
            md5,
            isDangerous: isExe || isMacro,
            rawBuffer: partBuf
          });
          continue;
        }
      }

      // If not an attachment, decode body text
      const decodedContent = decodeBodyContent(partBody, partEncoding);
      if (partMimeType.includes('html')) {
        result.decodedHtmlText += `\n${decodedContent}`;
      } else {
        result.decodedBodyText += `\n${decodedContent}`;
      }
    }
  } else {
    // Single-part body
    const encMatch = headerSection.match(/Content-Transfer-Encoding:\s*([^\r\n;]+)/i);
    const encoding = encMatch ? encMatch[1].trim().toLowerCase() : undefined;
    const decoded = decodeBodyContent(bodySection, encoding);

    if (cType && cType.includes('html')) {
      result.decodedHtmlText = decoded;
    } else {
      result.decodedBodyText = decoded;
    }
  }

  return result;
}
