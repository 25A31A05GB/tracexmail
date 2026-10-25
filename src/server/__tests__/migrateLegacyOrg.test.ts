import { describe, it, expect, vi } from 'vitest';
import {
  parseArgs,
  discoverTablesWithOrgId,
  getOrgRowCountsForTable,
  runLegacyOrgMigration,
  DEFAULT_LEGACY_ORG_ID,
  QueryableClient
} from '../../../scripts/migrate-legacy-org';

describe('ORG-1: migrate-legacy-org script', () => {
  describe('Argument Parsing', () => {
    it('defaults to dry-run mode (apply: false) when --apply is omitted', () => {
      const parsed = parseArgs(['org_target_123']);
      expect(parsed.targetOrgId).toBe('org_target_123');
      expect(parsed.sourceOrgId).toBe(DEFAULT_LEGACY_ORG_ID);
      expect(parsed.apply).toBe(false);
    });

    it('enables apply mode when --apply flag is passed', () => {
      const parsed = parseArgs(['--target=org_target_456', '--apply']);
      expect(parsed.targetOrgId).toBe('org_target_456');
      expect(parsed.apply).toBe(true);
    });

    it('supports --target with space and custom --source', () => {
      const parsed = parseArgs(['--target', 'org_custom_dest', '--source', 'org_custom_src', '--apply']);
      expect(parsed.targetOrgId).toBe('org_custom_dest');
      expect(parsed.sourceOrgId).toBe('org_custom_src');
      expect(parsed.apply).toBe(true);
    });
  });

  describe('Table Discovery', () => {
    it('queries information_schema for organization_id columns', async () => {
      const mockClient: QueryableClient = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { table_schema: 'public', table_name: 'cases' },
            { table_schema: 'public', table_name: 'alerts' }
          ]
        })
      };

      const tables = await discoverTablesWithOrgId(mockClient);
      expect(tables).toEqual([
        { schema: 'public', table: 'cases' },
        { schema: 'public', table: 'alerts' }
      ]);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("column_name = 'organization_id'"));
    });

    it('falls back to known tenant tables if information_schema query fails', async () => {
      const mockClient: QueryableClient = {
        query: vi.fn().mockRejectedValue(new Error('permission denied for information_schema'))
      };

      const tables = await discoverTablesWithOrgId(mockClient);
      expect(tables.length).toBeGreaterThan(5);
      expect(tables.some(t => t.table === 'cases')).toBe(true);
      expect(tables.some(t => t.table === 'gmail_connections')).toBe(true);
    });
  });

  describe('Per-Organization Row Counts', () => {
    it('retrieves row counts grouped by organization_id', async () => {
      const mockClient: QueryableClient = {
        query: vi.fn().mockResolvedValue({
          rows: [
            { organization_id: 'org_acme_soc_01', count: '42' },
            { organization_id: 'org_target_999', count: '5' }
          ]
        })
      };

      const counts = await getOrgRowCountsForTable(mockClient, 'public', 'cases');
      expect(counts['org_acme_soc_01']).toBe(42);
      expect(counts['org_target_999']).toBe(5);
    });
  });

  describe('Migration Execution Logic', () => {
    it('rejects migration if target organization is missing', async () => {
      await expect(
        runLegacyOrgMigration({ targetOrgId: '' })
      ).rejects.toThrow('Target organization ID is required');
    });

    it('rejects migration if target organization is identical to source organization', async () => {
      await expect(
        runLegacyOrgMigration({ targetOrgId: DEFAULT_LEGACY_ORG_ID, sourceOrgId: DEFAULT_LEGACY_ORG_ID })
      ).rejects.toThrow('cannot be identical');
    });

    it('executes in DRY RUN mode by default without executing UPDATE or COMMIT', async () => {
      const executedQueries: string[] = [];
      const mockClient: QueryableClient = {
        query: vi.fn().mockImplementation(async (text: string) => {
          executedQueries.push(text);
          if (text.includes('information_schema')) {
            return {
              rows: [
                { table_schema: 'public', table_name: 'cases' },
                { table_schema: 'public', table_name: 'alerts' }
              ]
            };
          }
          if (text.includes('GROUP BY organization_id')) {
            return {
              rows: [{ organization_id: 'org_acme_soc_01', count: '10' }]
            };
          }
          return { rows: [] };
        })
      };

      const result = await runLegacyOrgMigration({
        targetOrgId: 'org_target_corp',
        apply: false,
        client: mockClient
      });

      expect(result.applied).toBe(false);
      expect(result.totalSourceRows).toBe(20);
      expect(result.totalMigratedRows).toBe(0);

      // Verify no transaction or update queries were performed
      expect(executedQueries.some(q => q.includes('BEGIN'))).toBe(false);
      expect(executedQueries.some(q => q.includes('UPDATE'))).toBe(false);
      expect(executedQueries.some(q => q.includes('COMMIT'))).toBe(false);
    });

    it('executes transaction and updates records when apply is true', async () => {
      const executedQueries: string[] = [];
      const mockClient: QueryableClient = {
        query: vi.fn().mockImplementation(async (text: string, params?: any[]) => {
          executedQueries.push(text);
          if (text.includes('information_schema')) {
            return {
              rows: [
                { table_schema: 'public', table_name: 'cases' },
                { table_schema: 'public', table_name: 'gmail_connections' }
              ]
            };
          }
          if (text.includes('GROUP BY organization_id')) {
            return {
              rows: [{ organization_id: 'org_acme_soc_01', count: '7' }]
            };
          }
          if (text.includes('UPDATE')) {
            return { rows: [], rowCount: 7 };
          }
          return { rows: [], rowCount: 1 };
        })
      };

      const result = await runLegacyOrgMigration({
        targetOrgId: 'org_target_corp',
        apply: true,
        client: mockClient
      });

      expect(result.applied).toBe(true);
      expect(result.totalSourceRows).toBe(14);
      expect(result.totalMigratedRows).toBe(14);

      // Verify transaction flow: BEGIN -> INSERT org -> UPDATE tables -> COMMIT
      expect(executedQueries.some(q => q === 'BEGIN')).toBe(true);
      expect(executedQueries.some(q => q.includes('INSERT INTO organizations'))).toBe(true);
      expect(executedQueries.some(q => q.includes('UPDATE "public"."cases"'))).toBe(true);
      expect(executedQueries.some(q => q.includes('UPDATE "public"."gmail_connections"'))).toBe(true);
      expect(executedQueries.some(q => q === 'COMMIT')).toBe(true);
    });

    it('rolls back transaction on error when apply is true', async () => {
      const executedQueries: string[] = [];
      const mockClient: QueryableClient = {
        query: vi.fn().mockImplementation(async (text: string) => {
          executedQueries.push(text);
          if (text.includes('information_schema')) {
            return {
              rows: [{ table_schema: 'public', table_name: 'cases' }]
            };
          }
          if (text.includes('GROUP BY organization_id')) {
            return {
              rows: [{ organization_id: 'org_acme_soc_01', count: '5' }]
            };
          }
          if (text.includes('UPDATE')) {
            throw new Error('Database constraint violation');
          }
          return { rows: [], rowCount: 1 };
        })
      };

      await expect(
        runLegacyOrgMigration({
          targetOrgId: 'org_target_corp',
          apply: true,
          client: mockClient
        })
      ).rejects.toThrow('Database constraint violation');

      expect(executedQueries.some(q => q === 'BEGIN')).toBe(true);
      expect(executedQueries.some(q => q === 'ROLLBACK')).toBe(true);
      expect(executedQueries.some(q => q === 'COMMIT')).toBe(false);
    });
  });
});
