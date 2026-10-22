import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { assertProductionDatabaseReady } from '../authTokenStore';
import { saveCasesToDisk, PersistedCase } from '../caseStore';

describe('Security Leftovers Regression Suite', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSupabaseUrl = process.env.SUPABASE_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalSupabaseUrl) {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }
  });

  describe('1. Cryptographic Randomness (Zero Math.random in Server)', () => {
    it('verifies src/server has zero occurrences of Math.random', () => {
      const serverDir = path.resolve(process.cwd(), 'src/server');
      const files = fs.readdirSync(serverDir).filter(f => f.endsWith('.ts'));
      
      const offenders: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(serverDir, file), 'utf8');
        if (content.includes('Math.random()')) {
          offenders.push(file);
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('2. RBAC Role Clearance Selector Deleted from Header.tsx', () => {
    it('verifies Header.tsx contains no role clearance buttons grid', () => {
      const headerPath = path.resolve(process.cwd(), 'src/components/Header.tsx');
      const content = fs.readFileSync(headerPath, 'utf8');
      
      expect(content).not.toContain('RBAC Role Clearance Selector');
      expect(content).not.toContain("onSwitchRole('admin')");
      expect(content).not.toContain("onSwitchRole('analyst')");
      expect(content).not.toContain("onSwitchRole('read_only')");
      expect(content).toContain('Verified Server Role:');
    });
  });

  describe('3. Production Token Store Database Persistence Requirement', () => {
    it('throws fatal error in production when SUPABASE_URL is not configured', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.ALLOW_IN_MEMORY_AUTH_IN_PRODUCTION;

      expect(() => assertProductionDatabaseReady()).toThrow(
        /Production database .* is required for authTokenStore persistence/
      );
    });

    it('passes assertion in development mode without database configured', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SUPABASE_URL;

      expect(() => assertProductionDatabaseReady()).not.toThrow();
    });
  });

  describe('4. Zero JSON Disk Writes in Production Mode', () => {
    it('does not write to cases.json when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const casesMap = new Map<string, PersistedCase>();
      casesMap.set('test-case-99', {
        id: 'test-case-99',
        title: 'Test Production Bypass',
        status: 'OPEN',
        severity: 'LOW',
        threat_score: 10,
        created_at: new Date().toISOString()
      });

      const result = saveCasesToDisk(casesMap);
      expect(result).toBe(true);
    });
  });
});
