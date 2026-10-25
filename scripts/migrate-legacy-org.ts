/**
 * scripts/migrate-legacy-org.ts
 *
 * ORG-1 Legacy Organization Tenant Migration Utility
 *
 * Discovers every table with an `organization_id` column, counts rows per organization,
 * prints a comprehensive summary, and (only when --apply is passed) executes a database
 * transaction moving rows from the legacy organization (org_acme_soc_01) to the target organization.
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy-org.ts <target_organization_id>
 *   npx tsx scripts/migrate-legacy-org.ts --target=<target_organization_id> [--apply] [--source=<source_org_id>]
 *
 * Default mode: DRY RUN (no modifications made unless --apply is explicitly specified).
 */

import 'dotenv/config';
import { Client, PoolClient } from 'pg';

export const DEFAULT_LEGACY_ORG_ID = 'org_acme_soc_01';

export const KNOWN_TENANT_TABLES = [
  'profiles',
  'cases',
  'campaigns',
  'alerts',
  'evidence',
  'audit_logs',
  'case_notes',
  'user_testimonials',
  'classifier_corrections',
  'org_users',
  'auth_ephemeral_tokens',
  'gmail_connections',
  'gmail_processed_messages'
];

export interface MigrationOptions {
  targetOrgId: string;
  sourceOrgId?: string;
  apply?: boolean;
  connectionString?: string;
  client?: QueryableClient;
}

export interface TableReport {
  schema: string;
  table: string;
  countsByOrg: Record<string, number>;
  sourceRowCount: number;
  migratedRowCount?: number;
}

export interface MigrationResult {
  sourceOrgId: string;
  targetOrgId: string;
  applied: boolean;
  totalSourceRows: number;
  totalMigratedRows: number;
  tables: TableReport[];
}

export interface QueryableClient {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

/**
 * Parses CLI command line arguments.
 */
export function parseArgs(argv: string[]): { targetOrgId: string; sourceOrgId: string; apply: boolean } {
  let targetOrgId = '';
  let sourceOrgId = DEFAULT_LEGACY_ORG_ID;
  let apply = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
    } else if (arg.startsWith('--target=')) {
      targetOrgId = arg.slice('--target='.length).trim();
    } else if (arg === '--target' && i + 1 < argv.length) {
      targetOrgId = argv[++i].trim();
    } else if (arg.startsWith('--source=')) {
      sourceOrgId = arg.slice('--source='.length).trim();
    } else if (arg === '--source' && i + 1 < argv.length) {
      sourceOrgId = argv[++i].trim();
    } else if (!arg.startsWith('-') && !targetOrgId) {
      targetOrgId = arg.trim();
    }
  }

  return { targetOrgId, sourceOrgId, apply };
}

/**
 * Discovers all tables that have an `organization_id` column.
 */
export async function discoverTablesWithOrgId(client: QueryableClient): Promise<Array<{ schema: string; table: string }>> {
  try {
    const res = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.columns
      WHERE column_name = 'organization_id'
        AND table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);

    if (res && res.rows && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        schema: r.table_schema || 'public',
        table: r.table_name
      }));
    }
  } catch (err: any) {
    console.warn(`[TableDiscovery] Notice querying information_schema: ${err?.message || err}. Using known tenant tables list.`);
  }

  // Fallback to verified known tenant tables
  return KNOWN_TENANT_TABLES.map(table => ({ schema: 'public', table }));
}

/**
 * Counts rows per organization for a given table.
 */
export async function getOrgRowCountsForTable(
  client: QueryableClient,
  schema: string,
  table: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const res = await client.query(`
      SELECT organization_id, COUNT(*)::int AS count
      FROM "${schema}"."${table}"
      GROUP BY organization_id
      ORDER BY count DESC;
    `);

    if (res && res.rows) {
      for (const row of res.rows) {
        const org = row.organization_id || '(null)';
        counts[org] = parseInt(row.count, 10) || 0;
      }
    }
  } catch (err: any) {
    // If table does not exist or column is missing, record error note
    counts['(query_error)'] = 0;
  }
  return counts;
}

/**
 * Prints a formatted CLI summary of discovered tables and counts.
 */
export function printMigrationSummary(
  sourceOrgId: string,
  targetOrgId: string,
  reports: TableReport[],
  apply: boolean
): void {
  console.log('\n================================================================');
  console.log('       TRACEXMAIL TENANT MIGRATION SUMMARY (ORG-1)             ');
  console.log('================================================================');
  console.log(`Source Organization (Legacy) : ${sourceOrgId}`);
  console.log(`Target Organization          : ${targetOrgId}`);
  console.log(`Execution Mode               : ${apply ? '🚀 APPLY (TRANSACTION ACTIVE)' : '🔍 DRY RUN (NO CHANGES APPLIED)'}`);
  console.log('----------------------------------------------------------------');
  console.log(
    'Table Name'.padEnd(30) +
    'Legacy Rows'.padStart(14) +
    'Target Rows'.padStart(14) +
    'Other Orgs'.padStart(14)
  );
  console.log('----------------------------------------------------------------');

  let totalSource = 0;
  for (const rep of reports) {
    const legacy = rep.countsByOrg[sourceOrgId] || 0;
    const target = rep.countsByOrg[targetOrgId] || 0;
    const otherKeys = Object.keys(rep.countsByOrg).filter(k => k !== sourceOrgId && k !== targetOrgId);
    const otherTotal = otherKeys.reduce((acc, k) => acc + (rep.countsByOrg[k] || 0), 0);

    totalSource += legacy;
    const fullTableName = rep.schema === 'public' ? rep.table : `${rep.schema}.${rep.table}`;
    console.log(
      fullTableName.padEnd(30) +
      String(legacy).padStart(14) +
      String(target).padStart(14) +
      String(otherTotal).padStart(14)
    );
  }

  console.log('----------------------------------------------------------------');
  console.log(`Total Rows Queued for Migration: ${totalSource}`);
  console.log('================================================================\n');

  if (!apply) {
    console.log('ℹ️  DRY RUN ONLY: No database rows were modified.');
    console.log(`ℹ️  To execute this migration inside a Postgres transaction, pass '--apply':`);
    console.log(`   npx tsx scripts/migrate-legacy-org.ts --target=${targetOrgId} --apply\n`);
  }
}

/**
 * Executes or simulates legacy organization migration.
 */
export async function runLegacyOrgMigration(options: MigrationOptions): Promise<MigrationResult> {
  const { targetOrgId, sourceOrgId = DEFAULT_LEGACY_ORG_ID, apply = false } = options;

  if (!targetOrgId || targetOrgId.trim() === '') {
    throw new Error('Target organization ID is required. Pass --target=<org_id> or argument.');
  }

  if (targetOrgId === sourceOrgId) {
    throw new Error(`Target organization (${targetOrgId}) cannot be identical to source legacy organization (${sourceOrgId}).`);
  }

  let client: QueryableClient | null = options.client || null;
  let clientCreatedLocally = false;

  if (!client) {
    const connectionString =
      options.connectionString ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL or SUPABASE_DB_URL environment variable is required to execute migration.'
      );
    }

    const pgClient = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    await pgClient.connect();
    client = pgClient;
    clientCreatedLocally = true;
  }

  try {
    // 1. Discover all tables with organization_id column
    const tables = await discoverTablesWithOrgId(client);

    // 2. Count rows per organization in each discovered table
    const reports: TableReport[] = [];
    let totalSourceRows = 0;

    for (const t of tables) {
      const counts = await getOrgRowCountsForTable(client, t.schema, t.table);
      const sourceCount = counts[sourceOrgId] || 0;
      totalSourceRows += sourceCount;
      reports.push({
        schema: t.schema,
        table: t.table,
        countsByOrg: counts,
        sourceRowCount: sourceCount
      });
    }

    // 3. Print the summary report
    printMigrationSummary(sourceOrgId, targetOrgId, reports, apply);

    // 4. If not applying, return dry-run result
    if (!apply) {
      return {
        sourceOrgId,
        targetOrgId,
        applied: false,
        totalSourceRows,
        totalMigratedRows: 0,
        tables: reports
      };
    }

    // 5. Apply migration inside a single atomic transaction
    console.log('[Migration] Beginning atomic PostgreSQL transaction...');
    await client.query('BEGIN');

    try {
      // Ensure target organization exists in `organizations` table so foreign keys hold
      try {
        await client.query(
          `INSERT INTO organizations (id, name)
           VALUES ($1, $2)
           ON CONFLICT (id) DO NOTHING`,
          [targetOrgId, `Migrated Organization (${targetOrgId})`]
        );
      } catch (err: any) {
        console.warn(`[Migration] Notice ensuring target organization entry: ${err?.message}`);
      }

      let totalMigrated = 0;

      for (const rep of reports) {
        // Skip updating the `organizations` table directly via organization_id
        if (rep.table === 'organizations') continue;

        if (rep.sourceRowCount > 0) {
          const updateRes = await client.query(
            `UPDATE "${rep.schema}"."${rep.table}"
             SET organization_id = $1
             WHERE organization_id = $2`,
            [targetOrgId, sourceOrgId]
          );

          const count = updateRes.rowCount || 0;
          rep.migratedRowCount = count;
          totalMigrated += count;
          console.log(`[Migration] Updated ${count} rows in "${rep.schema}"."${rep.table}"`);
        } else {
          rep.migratedRowCount = 0;
        }
      }

      await client.query('COMMIT');
      console.log(`\n✅ [Migration SUCCESS] Successfully committed transaction. Migrated ${totalMigrated} rows to organization "${targetOrgId}".\n`);

      return {
        sourceOrgId,
        targetOrgId,
        applied: true,
        totalSourceRows,
        totalMigratedRows: totalMigrated,
        tables: reports
      };
    } catch (txErr: any) {
      console.error('[Migration ERROR] Transaction error encountered. Rolling back all changes...', txErr?.message || txErr);
      await client.query('ROLLBACK');
      throw txErr;
    }
  } finally {
    if (clientCreatedLocally && client && 'end' in client) {
      await (client as any).end().catch(() => {});
    }
  }
}

// CLI Entry point
if (process.argv[1] && process.argv[1].endsWith('migrate-legacy-org.ts')) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.targetOrgId) {
    console.error('❌ Error: Missing target organization ID.\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/migrate-legacy-org.ts <target_org_id> [--apply]');
    console.log('  npx tsx scripts/migrate-legacy-org.ts --target=<target_org_id> [--apply] [--source=<source_org_id>]\n');
    process.exit(1);
  }

  runLegacyOrgMigration(args)
    .then((result) => {
      if (!result.applied) {
        console.log('Completed dry-run inspection.');
      } else {
        console.log(`Migration finished with ${result.totalMigratedRows} rows updated.`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err?.message || err);
      process.exit(1);
    });
}
