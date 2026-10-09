import { describe, it, expect, beforeEach } from 'vitest';
import { 
  saveResetToken, 
  getResetToken, 
  deleteResetToken, 
  saveOtp, 
  getOtp, 
  deleteOtp, 
  saveMagicLink, 
  getMagicLink 
} from '../authTokenStore';

describe('Enclave Auth Recovery & Token Store', () => {
  const testEmail = 'analyst@acmedefense.sec';

  beforeEach(async () => {
    await deleteResetToken('test_rst_token');
    await deleteOtp(`recovery:${testEmail}`);
    await deleteOtp(`reset:${testEmail}`);
  });

  it('correctly persists and validates recovery reset tokens', async () => {
    const token = 'test_rst_token';
    const expiresAt = Date.now() + 30 * 60 * 1000;

    await saveResetToken(token, testEmail, expiresAt);
    const stored = await getResetToken(token);

    expect(stored).toBeDefined();
    expect(stored?.email).toBe(testEmail);
    expect(stored?.expiresAt).toBe(expiresAt);

    await deleteResetToken(token);
    const afterDelete = await getResetToken(token);
    expect(afterDelete).toBeNull();
  });

  it('correctly saves and verifies 6-digit one-time recovery codes (OTP)', async () => {
    const code = '582910';
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await saveOtp(`recovery:${testEmail}`, {
      code,
      email: testEmail,
      type: 'recovery',
      expiresAt,
      attempts: 0,
      lastSentAt: Date.now(),
      payload: null
    });

    const storedOtp = await getOtp(`recovery:${testEmail}`);
    expect(storedOtp).toBeDefined();
    expect(storedOtp?.code).toBe(code);
    expect(storedOtp?.email).toBe(testEmail);
  });

  it('stores and validates recovery magic links with full URL parameters', async () => {
    const magicToken = 'mlk_test_auth_recovery_123';
    const expiresAt = Date.now() + 30 * 60 * 1000;

    await saveMagicLink(magicToken, {
      token: magicToken,
      email: testEmail,
      type: 'recovery',
      expiresAt,
      lastSentAt: Date.now(),
      used: false,
      payload: null
    });

    const record = await getMagicLink(magicToken);
    expect(record).toBeDefined();
    expect(record?.email).toBe(testEmail);
    expect(record?.type).toBe('recovery');
  });
});
