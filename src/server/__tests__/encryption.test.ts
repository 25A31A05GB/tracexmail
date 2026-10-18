import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  initEncryptionKeys,
  encrypt,
  decrypt,
  isEncrypted,
  isEncryptedWithActiveKey,
  reencryptWithActiveKey,
  EnvKeyProvider,
  verifyStartupKeys
} from '../crypto/encryption';
import { redactSensitiveData, REDACTION_PATHS } from '../logger';

describe('AES-256-GCM Encryption & Key Rotation Subsystem', () => {
  const key1 = crypto.randomBytes(32).toString('base64');
  const key2 = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEYS = JSON.stringify({
      k1: key1,
      k2: key2
    });
    process.env.TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'k1';
    initEncryptionKeys();
  });

  it('performs clean round-trip encryption and decryption', () => {
    const sensitiveSecret = 'google_oauth_refresh_token_xyz987654321';
    const ciphertext = encrypt(sensitiveSecret);

    expect(isEncrypted(ciphertext)).toBe(true);
    expect(ciphertext.startsWith('v1:k1:')).toBe(true);
    expect(isEncryptedWithActiveKey(ciphertext)).toBe(true);

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(sensitiveSecret);
  });

  it('supports seamless key rotation and re-encryption', () => {
    // Encrypt with key k1
    const secret = 'webhook_secret_key_production_123';
    const ciphertextK1 = encrypt(secret, 'k1');
    expect(ciphertextK1.startsWith('v1:k1:')).toBe(true);

    // Rotate active key to k2
    process.env.TOKEN_ENCRYPTION_ACTIVE_KEY_ID = 'k2';
    initEncryptionKeys();

    // Verify k1 ciphertext can still be decrypted by k2-active instance
    expect(decrypt(ciphertextK1)).toBe(secret);
    expect(isEncryptedWithActiveKey(ciphertextK1)).toBe(false);

    // Re-encrypt to active key
    const { reencrypted, changed } = reencryptWithActiveKey(ciphertextK1);
    expect(changed).toBe(true);
    expect(reencrypted.startsWith('v1:k2:')).toBe(true);
    expect(isEncryptedWithActiveKey(reencrypted)).toBe(true);
    expect(decrypt(reencrypted)).toBe(secret);
  });

  it('detects tampering and throws an error on corrupted ciphertext, iv, or tag', () => {
    const plaintext = 'sensitive_case_evidence_details';
    const ciphertext = encrypt(plaintext);
    const parts = ciphertext.split(':');

    // 1. Corrupt the IV
    const corruptedIvParts = [...parts];
    corruptedIvParts[2] = 'AAAA' + parts[2].slice(4);
    expect(() => decrypt(corruptedIvParts.join(':'))).toThrow();

    // 2. Corrupt the Auth Tag
    const corruptedTagParts = [...parts];
    corruptedTagParts[3] = 'BBBB' + parts[3].slice(4);
    expect(() => decrypt(corruptedTagParts.join(':'))).toThrow();

    // 3. Corrupt the Ciphertext Data
    const corruptedDataParts = [...parts];
    corruptedDataParts[4] = 'CCCC' + parts[4].slice(4);
    expect(() => decrypt(corruptedDataParts.join(':'))).toThrow();
  });

  it('implements organization envelope encryption (per-org data keys)', async () => {
    const keyProvider = new EnvKeyProvider();
    const org1 = 'org-cyber-ops';
    const org2 = 'org-incident-response';

    const evidence1 = 'From: attacker@evil.com\nSubject: Wire Transfer';
    const enc1 = await keyProvider.encryptOrgData(org1, evidence1);

    expect(enc1.startsWith(`v1:org:${org1}:`)).toBe(true);

    const decrypted1 = await keyProvider.decryptOrgData(org1, enc1);
    expect(decrypted1.toString('utf8')).toBe(evidence1);

    // Cross-tenant protection: attempting to decrypt org1 data with org2 key must throw
    await expect(keyProvider.decryptOrgData(org2, enc1)).rejects.toThrow(/mismatch/i);
  });

  it('redacts sensitive credentials and tokens from logger data', () => {
    const payload = {
      user: 'secops@acme.com',
      authorization: 'Bearer secret_token_123',
      cookie: 'session_id=xyz',
      token: 'jwt_token_here',
      secret: 'super_secret',
      password: 'password123',
      api_key: 'txm_live_key',
      refresh_token: 'refresh_tok_abc',
      nested: {
        accessToken: 'access_abc',
        clientSecret: 'secret_client'
      }
    };

    const redacted = redactSensitiveData(payload);
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.secret).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.api_key).toBe('[REDACTED]');
    expect(redacted.refresh_token).toBe('[REDACTED]');
    expect(redacted.nested.accessToken).toBe('[REDACTED]');
    expect(redacted.nested.clientSecret).toBe('[REDACTED]');
    expect(redacted.user).toBe('secops@acme.com');

    // Ensure REDACTION_PATHS covers critical fields
    expect(REDACTION_PATHS).toContain('authorization');
    expect(REDACTION_PATHS).toContain('cookie');
    expect(REDACTION_PATHS).toContain('token');
    expect(REDACTION_PATHS).toContain('secret');
    expect(REDACTION_PATHS).toContain('password');
    expect(REDACTION_PATHS).toContain('api_key');
    expect(REDACTION_PATHS).toContain('refresh_token');
  });

  it('verifies startup keys and flags weak or missing keys in production', () => {
    const check = verifyStartupKeys();
    expect(check.valid).toBe(true);
    expect(check.errors.length).toBe(0);
  });
});
