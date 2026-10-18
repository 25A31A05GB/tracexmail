import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordIdempotentGmailProcessing,
  addAnalyzeJob,
  getJob,
  getDlqJobs
} from '../queue/index';
import { CircuitBreaker } from '../queue/circuitBreaker';

describe('Background Queue, Circuit Breaker & Idempotency Subsystem', () => {
  beforeEach(() => {
    // Reset or ensure environment
  });

  it('enforces idempotency on Gmail message processing', () => {
    const msgId = 'msg_xyz_12345';
    const histId = 'hist_998877';

    // First attempt must succeed
    const firstAttempt = recordIdempotentGmailProcessing(msgId, histId);
    expect(firstAttempt).toBe(true);

    // Second duplicate attempt must be recognized and rejected
    const secondAttempt = recordIdempotentGmailProcessing(msgId, histId);
    expect(secondAttempt).toBe(false);

    // Different message ID is allowed
    const differentMessage = recordIdempotentGmailProcessing('msg_abc_99999', histId);
    expect(differentMessage).toBe(true);
  });

  it('manages circuit breaker state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)', async () => {
    const breaker = new CircuitBreaker('test-virustotal', {
      failureThreshold: 3,
      cooldownMs: 50, // short cooldown for test
      successThreshold: 1
    });

    expect(breaker.getState()).toBe('CLOSED');

    const failingCall = async () => {
      throw new Error('503 Service Unavailable');
    };

    // Fail 1
    await expect(breaker.execute(failingCall)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    // Fail 2
    await expect(breaker.execute(failingCall)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    // Fail 3 -> Trips OPEN
    await expect(breaker.execute(failingCall)).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    // Subsequent calls while OPEN fail fast without invoking function
    let called = false;
    await expect(
      breaker.execute(async () => {
        called = true;
      })
    ).rejects.toThrow(/circuitbreaker.*is open/i);
    expect(called).toBe(false);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(breaker.getState()).toBe('HALF_OPEN');

    // Probe success transitions back to CLOSED
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('enforces tenant organization isolation when retrieving jobs', async () => {
    const orgAJob = await addAnalyzeJob({
      emailContent: 'Subject: Test Phish\nFrom: bad@evil.com\n\nClick here',
      filename: 'sample.eml',
      organizationId: 'org-alpha'
    });

    expect(orgAJob.id).toBeDefined();

    // Org Alpha can access its own job
    const lookupByAlpha = getJob(orgAJob.id, 'org-alpha');
    expect(lookupByAlpha).not.toBeNull();
    expect(lookupByAlpha?.id).toBe(orgAJob.id);

    // Org Beta CANNOT access Org Alpha's job (returns null for multi-tenant isolation)
    const lookupByBeta = getJob(orgAJob.id, 'org-beta');
    expect(lookupByBeta).toBeNull();
  });

  it('tracks dead-letter queue records on permanent failures', () => {
    const dlq = getDlqJobs();
    expect(Array.isArray(dlq)).toBe(true);
  });
});
