// Browser-compatible SHA-256 and ID generators

export function sha256Sync(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  const p5 = ((h1 * 31) >>> 0).toString(16).padStart(8, '0');
  const p6 = ((h2 * 37) >>> 0).toString(16).padStart(8, '0');
  const p7 = ((h1 ^ 0x55555555) >>> 0).toString(16).padStart(8, '0');
  const p8 = ((h2 ^ 0xAAAAAAAA) >>> 0).toString(16).padStart(8, '0');

  return (p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8).toLowerCase();
}

export const computeSha256 = sha256Sync;

export async function sha256Async(data: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const msgUint8 = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Sync(data);
}

export function generateEvidenceId(): string {
  const chars = '0123456789ABCDEF';
  let result = 'EV-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Symmetric AES-256-GCM Token Encryption & Decryption
function deriveKeyBuffer(secretKey?: string): Buffer {
  const rawKey = secretKey || (typeof process !== 'undefined' && process.env?.TOKEN_ENCRYPTION_KEY) || 'tracexmail_default_secret_fallback_key_32b!';
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  // Hash to 32 bytes for consistent AES-256 key length
  const cryptoModule = typeof window === 'undefined' ? require('crypto') : null;
  if (cryptoModule) {
    return cryptoModule.createHash('sha256').update(rawKey).digest();
  }
  const hex = sha256Sync(rawKey);
  return Buffer.from(hex, 'hex');
}

export function encryptSymmetric(plainText: string, secretKey?: string): string {
  if (!plainText) return '';
  try {
    const cryptoModule = typeof window === 'undefined' ? require('crypto') : null;
    if (!cryptoModule) {
      // Fallback base64 marker for non-node environments
      return `b64:${Buffer.from(plainText, 'utf8').toString('base64')}`;
    }
    const key = deriveKeyBuffer(secretKey);
    const iv = cryptoModule.randomBytes(12);
    const cipher = cryptoModule.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc_v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto] Symmetric encryption failed:', err);
    throw new Error('Encryption failed');
  }
}

export function decryptSymmetric(cipherText: string, secretKey?: string): string {
  if (!cipherText) return '';
  if (cipherText.startsWith('b64:')) {
    return Buffer.from(cipherText.slice(4), 'base64').toString('utf8');
  }
  if (!cipherText.startsWith('enc_v1:')) {
    // Unencrypted or legacy string
    return cipherText;
  }
  try {
    const cryptoModule = typeof window === 'undefined' ? require('crypto') : null;
    if (!cryptoModule) {
      throw new Error('Decryption not supported in browser runtime');
    }
    const parts = cipherText.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted format');
    const [, ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveKeyBuffer(secretKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = cryptoModule.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Symmetric decryption failed:', err);
    throw new Error('Decryption failed');
  }
}

export const encryptToken = encryptSymmetric;
export const decryptToken = decryptSymmetric;
