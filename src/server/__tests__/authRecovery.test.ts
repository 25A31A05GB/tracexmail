import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { 
  saveResetToken, 
  getResetToken, 
  deleteResetToken, 
  saveOtp, 
  getOtp, 
  deleteOtp, 
  saveMagicLink, 
  getMagicLink,
  createAndStoreToken,
  consumeToken,
  verifyAndConsumeOtp,
  hashSecret,
  invalidateEarlierTokens,
  peekToken
} from '../authTokenStore';
import { createAuthRouter, localUserAccounts } from '../authRoutes';

describe('Auth Recovery & Security Regression Suite', () => {
  const testEmail = 'analyst@acmedefense.sec';
  const unknownEmail = 'doesnotexist@nowhere.corp';

  let app: express.Express;

  beforeEach(async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 're_test_mock_key_for_unit_tests';
    delete process.env.ALLOW_DEV_AUTH_PREVIEW;

    await deleteResetToken('test_rst_token');
    await deleteOtp(`recovery:${testEmail}`);
    await deleteOtp(`reset:${testEmail}`);
    await deleteOtp(`signin:${testEmail}`);
    await deleteOtp(`signup:${testEmail}`);
    await invalidateEarlierTokens(testEmail);

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter({ broadcastAlertFn: () => {} }));
  });

  describe('Token Lifecycle & Ephemeral Token Store', () => {
    it('correctly persists and validates recovery reset tokens with SHA-256 hash', async () => {
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

    it('correctly saves and verifies 6-digit one-time recovery codes (OTP) as SHA-256 hash', async () => {
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
      // Code is stored securely as SHA-256 hash, not plaintext
      expect(storedOtp?.code).toBe(hashSecret(code));
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

    it('a token cannot be reused (atomic single use)', async () => {
      const rawToken = await createAndStoreToken(testEmail, 'reset');
      expect(rawToken).toBeTruthy();

      // First consumption succeeds
      const firstConsume = await consumeToken(rawToken, 'reset', testEmail);
      expect(firstConsume.valid).toBe(true);

      // Second consumption must fail (replay attack prevented)
      const secondConsume = await consumeToken(rawToken, 'reset', testEmail);
      expect(secondConsume.valid).toBe(false);
      expect(secondConsume.error).toMatch(/used/i);
    });

    it('a token cannot be used after expiry', async () => {
      // Issue token that expires immediately (-10 seconds)
      const expiredToken = await createAndStoreToken(testEmail, 'reset', undefined, undefined, -10000);
      const result = await consumeToken(expiredToken, 'reset', testEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('a token cannot be used with a different email', async () => {
      const rawToken = await createAndStoreToken(testEmail, 'reset');
      const result = await consumeToken(rawToken, 'reset', 'attacker@evil.org');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('a token for purpose signin cannot reset a password', async () => {
      const signinToken = await createAndStoreToken(testEmail, 'signin');
      const result = await consumeToken(signinToken, 'reset', testEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('purpose');
    });

    it('OTP lockout after 5 failed attempts locks for 15 minutes', async () => {
      const correctCode = '654321';
      await saveOtp(`reset:${testEmail}`, {
        code: correctCode,
        email: testEmail,
        type: 'reset',
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        lastSentAt: Date.now(),
        payload: null
      });

      // 4 wrong attempts
      for (let i = 1; i <= 4; i++) {
        const attempt = await verifyAndConsumeOtp(testEmail, 'reset', '000000');
        expect(attempt.valid).toBe(false);
        expect(attempt.locked).toBeFalsy();
      }

      // 5th wrong attempt triggers lockout
      const fifthAttempt = await verifyAndConsumeOtp(testEmail, 'reset', '000000');
      expect(fifthAttempt.valid).toBe(false);
      expect(fifthAttempt.locked).toBe(true);
      expect(fifthAttempt.error).toContain('locked');

      // Subsequent attempt with CORRECT code is still locked out
      const lockedAttempt = await verifyAndConsumeOtp(testEmail, 'reset', correctCode);
      expect(lockedAttempt.valid).toBe(false);
      expect(lockedAttempt.locked).toBe(true);
    });
  });

  describe('Endpoint Security & Secret Leak Prevention', () => {
    const FORBIDDEN_SECRET_KEYS = [
      'token',
      'resetToken',
      'code',
      'otp_code',
      'preview_code',
      'magic_link',
      'magicLinkUrl',
      'directResetUrl',
      'debugLink'
    ];

    it('/api/auth/reset-password response JSON contains none of the secret keys in production', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      for (const key of FORBIDDEN_SECRET_KEYS) {
        expect(res.body).not.toHaveProperty(key);
      }
    });

    it('/api/auth/magic-link/send response JSON contains none of the secret keys in production', async () => {
      const res = await request(app)
        .post('/api/auth/magic-link/send')
        .send({ email: testEmail, type: 'signin' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      for (const key of FORBIDDEN_SECRET_KEYS) {
        expect(res.body).not.toHaveProperty(key);
      }
    });

    it('/api/auth/resend-verification response JSON contains none of the secret keys in production', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      for (const key of FORBIDDEN_SECRET_KEYS) {
        expect(res.body).not.toHaveProperty(key);
      }
    });

    it('identical responses for existing and unknown emails on reset-password', async () => {
      // Setup existing local user
      localUserAccounts.set(testEmail, {
        id: 'usr_test_123',
        email: testEmail,
        passwordHash: 'dummy_hash',
        fullName: 'Test Analyst',
        orgName: 'Acme Cyber Defense SOC',
        role: 'analyst',
        accountType: 'organization',
        emailVerified: true,
        updatedAt: new Date().toISOString()
      });

      const existingRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: testEmail });

      const unknownRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: unknownEmail });

      expect(existingRes.status).toBe(unknownRes.status);
      expect(existingRes.body).toEqual(unknownRes.body);
      expect(existingRes.body.status).toBe('success');
      expect(existingRes.body.message).toBe('If an account exists for this email, we sent instructions.');
    });

    it('a scanner-style GET on the magic link does not sign in (405 Method Not Allowed)', async () => {
      const token = await createAndStoreToken(testEmail, 'signin');

      const getRes = await request(app)
        .get(`/api/auth/magic-link/verify?token=${token}&email=${testEmail}`);

      // Must be 405 Method Not Allowed to reject crawlers/pre-fetchers
      expect(getRes.status).toBe(405);
      expect(getRes.body.error?.toLowerCase()).toContain('scanner');

      // Verify token was NOT consumed by the GET prefetch
      const peek = await peekToken(token, 'signin', testEmail);
      expect(peek.valid).toBe(true);
      expect(peek.record?.used).toBe(false);
    });

    it('all sessions and earlier tokens revoked after reset-password-with-token', async () => {
      // 1. Issue multiple tokens for user
      const oldToken1 = await createAndStoreToken(testEmail, 'reset');
      const oldToken2 = await createAndStoreToken(testEmail, 'signin');
      const activeResetToken = await createAndStoreToken(testEmail, 'reset');

      // Setup user in local store
      localUserAccounts.set(testEmail, {
        id: 'usr_pwd_test',
        email: testEmail,
        passwordHash: 'old_hash',
        fullName: 'Password Test',
        orgName: 'SOC',
        role: 'analyst',
        accountType: 'organization',
        emailVerified: true,
        updatedAt: new Date().toISOString()
      });

      // 2. Perform password reset with active token
      const res = await request(app)
        .post('/api/auth/reset-password-with-token')
        .send({
          email: testEmail,
          resetToken: activeResetToken,
          newPassword: 'CorrectHorseBatteryStaple123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // 3. Outstanding tokens must be revoked
      const checkOld1 = await peekToken(oldToken1);
      const checkOld2 = await peekToken(oldToken2);
      expect(checkOld1.valid).toBe(false);
      expect(checkOld2.valid).toBe(false);
    });

    it('fails with 503 if email delivery is not configured in production', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SMTP_HOST;

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: testEmail });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EMAIL_SERVICE_UNAVAILABLE');
    });
  });
});
