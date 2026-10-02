import { describe, it, expect } from 'vitest';
import {
  loadCasesFromDisk,
  upsertPersistedCase,
  getPersistedCase,
  deletePersistedCase,
  getPersistedCases,
  DEFAULT_BASELINE_CASES,
  PersistedCase
} from '../caseStore';

describe('Persistent Case Storage Engine', () => {
  it('loads baseline cases if disk file is initialized', () => {
    const cases = loadCasesFromDisk();
    expect(cases.size).toBeGreaterThan(0);
    expect(cases.has('CASE-2026-0881')).toBe(true);
    expect(cases.has('CASE-2026-0882')).toBe(true);
  });

  it('persists a new case and allows retrieval', () => {
    const testCase: PersistedCase = {
      id: `case-test-${Date.now()}`,
      title: 'Persistent Verification Case',
      description: 'Test case verifying permanent disk retention',
      status: 'OPEN',
      severity: 'HIGH',
      threat_score: 85,
      created_at: new Date().toISOString(),
      user_email: 'jayramsappa537@gmail.com',
      assigned_user: 'Lead Analyst'
    };

    upsertPersistedCase(testCase);

    const retrieved = getPersistedCase(testCase.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(testCase.id);
    expect(retrieved?.user_email).toBe('jayramsappa537@gmail.com');

    // Clean up
    deletePersistedCase(testCase.id);
    expect(getPersistedCase(testCase.id)).toBeUndefined();
  });

  it('contains verified baseline cases for the security dashboard', () => {
    const all = getPersistedCases();
    expect(all.length).toBeGreaterThanOrEqual(DEFAULT_BASELINE_CASES.length);
    const becCase = all.find(c => c.id === 'CASE-2026-0881');
    expect(becCase).toBeDefined();
    expect(becCase?.classification).toContain('BEC');
    expect(becCase?.severity).toBe('CRITICAL');
  });
});
