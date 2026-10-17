/**
 * One-Time Idempotent Migration Script: JSON to Supabase / PostgreSQL
 *
 * Migrates data from local JSON disk files into durable database tables:
 * - data/cases.json -> cases table
 * - data/org_users.json -> org_users & profiles tables
 * - data/datasets/classifier_corrections.json -> classifier_corrections table
 * - data/user_testimonials.json -> user_testimonials table
 *
 * Only seeds demo data if ENABLE_DEMO_SEED === 'true'.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdminClient, DEFAULT_ORG_ID } from '../src/server/supabase';
import { DEFAULT_BASELINE_CASES, PersistedCase } from '../src/server/caseStore';

async function runMigration() {
  console.log('[Migration] Starting idempotent JSON to Database migration...');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn('[Migration] Supabase client is not configured (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing).');
    console.warn('[Migration] Operating in offline simulation mode; database writes skipped.');
    return;
  }

  const isDemoSeedEnabled = process.env.ENABLE_DEMO_SEED === 'true';

  // 1. Ensure primary organization exists
  try {
    const { error: orgErr } = await supabase.from('organizations').upsert(
      {
        id: DEFAULT_ORG_ID,
        name: 'Acme Cyber Defense SOC'
      },
      { onConflict: 'id' }
    );
    if (orgErr) console.warn('[Migration] Organization upsert notice:', orgErr.message);
    else console.log('[Migration] Verified primary organization: org_acme_soc_01');
  } catch (err: any) {
    console.warn('[Migration] Organization error:', err?.message);
  }

  // 2. Migrate Cases (data/cases.json)
  const casesFile = path.join(process.cwd(), 'data/cases.json');
  let casesToMigrate: PersistedCase[] = [];
  if (fs.existsSync(casesFile)) {
    try {
      const raw = fs.readFileSync(casesFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) casesToMigrate = parsed;
    } catch (e: any) {
      console.warn('[Migration] Error reading data/cases.json:', e.message);
    }
  }

  if (casesToMigrate.length === 0 && isDemoSeedEnabled) {
    console.log('[Migration] ENABLE_DEMO_SEED is true. Seeding default baseline cases...');
    casesToMigrate = DEFAULT_BASELINE_CASES;
  }

  if (casesToMigrate.length > 0) {
    const caseRows = casesToMigrate.map((c) => ({
      id: c.id,
      organization_id: c.organization_id || DEFAULT_ORG_ID,
      user_id: c.user_id || null,
      user_email: c.user_email || null,
      created_by: c.created_by || null,
      title: c.title,
      description: c.description || null,
      status: c.status || 'OPEN',
      severity: c.severity || 'HIGH',
      threat_score: c.threat_score ?? (c.threatScore ?? 0),
      threat_score_breakdown: c.threat_score_breakdown || {},
      classification: c.classification || 'SUSPICIOUS',
      auth: c.auth || {},
      heuristics: c.heuristics || [],
      hops: c.hops || [],
      origin_ip: c.origin_ip || null,
      origin_country: c.origin_country || null,
      origin_asn: c.origin_asn || null,
      origin_asn_org: c.origin_asn_org || null,
      infra_type: c.infra_type || null,
      from_domain: c.from_domain || null,
      assigned_user: c.assigned_user || null,
      tags: c.tags || [],
      source: c.source || 'pipeline',
      is_demo: Boolean(c.is_demo),
      headers: c.headers || {},
      why: c.why || null,
      raw_analysis: c.raw_analysis || null,
      created_at: c.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    try {
      const { error: casesErr } = await supabase.from('cases').upsert(caseRows, { onConflict: 'id' });
      if (casesErr) console.warn('[Migration] Cases upsert notice:', casesErr.message);
      else console.log(`[Migration] Migrated ${caseRows.length} cases.`);
    } catch (err: any) {
      console.warn('[Migration] Cases upsert exception:', err?.message);
    }
  }

  // 3. Migrate Org Users (data/org_users.json)
  const usersFile = path.join(process.cwd(), 'data/org_users.json');
  if (fs.existsSync(usersFile)) {
    try {
      const raw = fs.readFileSync(usersFile, 'utf8');
      const users: any[] = JSON.parse(raw);
      if (Array.isArray(users) && users.length > 0) {
        const userRows = users.map((u) => {
          delete u.clearPassword; // Enforce zero plaintext
          return {
            id: u.id,
            organization_id: u.organizationId || DEFAULT_ORG_ID,
            organization_name: u.organizationName || null,
            name: u.name,
            email: u.email.toLowerCase(),
            employee_id: u.employeeId || null,
            role: u.role,
            permissions: u.permissions || {},
            status: u.status || 'ACTIVE',
            password_hash: u.passwordHash,
            last_active: u.lastActive || null,
            created_by: u.createdBy || null,
            notification_status: u.notificationStatus || null,
            notification_history: u.notificationHistory || [],
            created_at: u.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });

        const { error: uErr } = await supabase.from('org_users').upsert(userRows, { onConflict: 'id' });
        if (uErr) console.warn('[Migration] org_users upsert notice:', uErr.message);
        else console.log(`[Migration] Migrated ${userRows.length} org users.`);

        // Mirror to profiles
        const profileRows = userRows.map((u) => ({
          id: u.id,
          organization_id: u.organization_id,
          email: u.email,
          full_name: u.name,
          role: u.role,
          account_type: 'organization',
          email_verified: true,
          updated_at: new Date().toISOString()
        }));
        await supabase.from('profiles').upsert(profileRows, { onConflict: 'id' });
        console.log(`[Migration] Mirrored ${profileRows.length} user profiles.`);
      }
    } catch (err: any) {
      console.warn('[Migration] Org users migration notice:', err?.message);
    }
  }

  // 4. Migrate Classifier Corrections (data/datasets/classifier_corrections.json)
  const correctionsFile = path.join(process.cwd(), 'data/datasets/classifier_corrections.json');
  if (fs.existsSync(correctionsFile)) {
    try {
      const raw = fs.readFileSync(correctionsFile, 'utf8');
      const corrections: any[] = JSON.parse(raw);
      if (Array.isArray(corrections) && corrections.length > 0) {
        const corrRows = corrections.map((c) => ({
          id: c.id,
          case_id: c.case_id,
          original_analysis_id: c.original_analysis_id || c.case_id,
          organization_id: c.organization_id || DEFAULT_ORG_ID,
          subject: c.subject,
          from_address: c.from,
          from_domain: c.from_domain,
          body_snippet: c.body_snippet,
          model_prediction: c.model_prediction,
          model_confidence: c.model_confidence,
          model_threat_score: c.model_threat_score,
          analyst_verdict: c.analyst_verdict,
          analyst_notes: c.analyst_notes,
          analyst_id: c.analyst_id,
          analyst_email: c.analyst_email,
          status: c.status || 'pending_review',
          created_at: c.created_at || new Date().toISOString(),
          reviewed_at: c.reviewed_at || null,
          reviewed_by: c.reviewed_by || null,
          review_notes: c.review_notes || null
        }));

        const { error: cErr } = await supabase.from('classifier_corrections').upsert(corrRows, { onConflict: 'id' });
        if (cErr) console.warn('[Migration] classifier_corrections upsert notice:', cErr.message);
        else console.log(`[Migration] Migrated ${corrRows.length} classifier corrections.`);
      }
    } catch (err: any) {
      console.warn('[Migration] Corrections migration notice:', err?.message);
    }
  }

  // 5. Migrate User Testimonials (data/user_testimonials.json)
  const testimonialsFile = path.join(process.cwd(), 'data/user_testimonials.json');
  if (fs.existsSync(testimonialsFile)) {
    try {
      const raw = fs.readFileSync(testimonialsFile, 'utf8');
      const testimonials: any[] = JSON.parse(raw);
      if (Array.isArray(testimonials) && testimonials.length > 0) {
        const testRows = testimonials.map((t) => ({
          id: t.id,
          organization_id: DEFAULT_ORG_ID,
          name: t.name,
          role: t.role,
          organization: t.organization || null,
          rating: t.rating,
          feedback: t.feedback,
          impact_metric: t.impactMetric || null,
          verified: t.verified ?? true,
          verification_digest: t.verificationDigest || null,
          created_at: t.createdAt || new Date().toISOString(),
          is_reported: Boolean(t.isReported),
          report_count: t.reportCount || 0,
          report_reason: t.reportReason || null,
          reported_at: t.reportedAt || null,
          moderation_status: t.moderationStatus || 'approved'
        }));

        const { error: tErr } = await supabase.from('user_testimonials').upsert(testRows, { onConflict: 'id' });
        if (tErr) console.warn('[Migration] user_testimonials upsert notice:', tErr.message);
        else console.log(`[Migration] Migrated ${testRows.length} user testimonials.`);
      }
    } catch (err: any) {
      console.warn('[Migration] Testimonials migration notice:', err?.message);
    }
  }

  console.log('[Migration] Database migration completed successfully.');
}

if (require.main === module || (process.argv[1] && process.argv[1].includes('migrate_json_to_db'))) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration] Migration fatal error:', err);
      process.exit(1);
    });
}

export { runMigration };
