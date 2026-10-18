import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface UserTestimonial {
  id: string;
  name: string;
  role: string;
  organization?: string;
  rating: number;
  feedback: string;
  impactMetric?: string;
  verified: boolean;
  verificationDigest: string;
  createdAt: string;
  isReported?: boolean;
  reportCount?: number;
  reportReason?: string;
  reportedAt?: string;
  moderationStatus?: 'approved' | 'hidden';
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const TESTIMONIALS_FILE = isTestEnv
  ? path.join(os.tmpdir(), 'user_testimonials.test.json')
  : path.join(DATA_DIR, 'user_testimonials.json');

// In-memory cache
let inMemoryTestimonials: UserTestimonial[] = [];
let isLoaded = false;

function loadTestimonialsFromDisk(): UserTestimonial[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(TESTIMONIALS_FILE)) {
      const raw = fs.readFileSync(TESTIMONIALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    const primaryFile = path.join(DATA_DIR, 'user_testimonials.json');
    if (fs.existsSync(primaryFile)) {
      const raw = fs.readFileSync(primaryFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[testimonialStore] Could not read user_testimonials.json from disk:', err);
  }
  return [];
}

import { getSupabaseAdminClient, DEFAULT_ORG_ID } from './supabase';

function syncTestimonialToDb(t: UserTestimonial): void {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const payload = {
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
    created_at: t.createdAt,
    is_reported: Boolean(t.isReported),
    report_count: t.reportCount || 0,
    report_reason: t.reportReason || null,
    reported_at: t.reportedAt || null,
    moderation_status: t.moderationStatus || 'approved'
  };

  Promise.resolve(
    supabase
      .from('user_testimonials')
      .upsert(payload, { onConflict: 'id' })
  )
    .then(({ error }: any) => {
      if (error) console.warn('[testimonialStore] Supabase upsert notice:', error.message);
    })
    .catch((err: any) => console.warn('[testimonialStore] Supabase exception:', err?.message));
}

function saveTestimonialsToDisk(testimonials: UserTestimonial[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(testimonials, null, 2), 'utf-8');
    testimonials.forEach(syncTestimonialToDb);
    return true;
  } catch (err) {
    console.error('[testimonialStore] Failed to write testimonials to disk:', err);
    return false;
  }
}

export function getLiveTestimonials(includeHidden: boolean = false): UserTestimonial[] {
  if (!isLoaded) {
    inMemoryTestimonials = loadTestimonialsFromDisk();
    isLoaded = true;
  }
  const filtered = includeHidden 
    ? inMemoryTestimonials 
    : inMemoryTestimonials.filter(t => t.moderationStatus !== 'hidden');
  // Return sorted newest first
  return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function reportTestimonial(id: string, reason?: string): UserTestimonial | null {
  if (!isLoaded) {
    inMemoryTestimonials = loadTestimonialsFromDisk();
    isLoaded = true;
  }
  const item = inMemoryTestimonials.find(t => t.id === id);
  if (!item) return null;
  item.isReported = true;
  item.reportCount = (item.reportCount || 0) + 1;
  item.reportReason = reason || item.reportReason || 'Inappropriate content flagged by user';
  item.reportedAt = new Date().toISOString();
  saveTestimonialsToDisk(inMemoryTestimonials);
  return item;
}

export function updateModerationStatus(id: string, status: 'approved' | 'hidden'): UserTestimonial | null {
  if (!isLoaded) {
    inMemoryTestimonials = loadTestimonialsFromDisk();
    isLoaded = true;
  }
  const item = inMemoryTestimonials.find(t => t.id === id);
  if (!item) return null;
  item.moderationStatus = status;
  saveTestimonialsToDisk(inMemoryTestimonials);
  return item;
}

export function addLiveTestimonial(data: {
  name: string;
  role: string;
  organization?: string;
  rating: number;
  feedback: string;
  impactMetric?: string;
}): UserTestimonial {
  if (!isLoaded) {
    inMemoryTestimonials = loadTestimonialsFromDisk();
    isLoaded = true;
  }

  const cleanName = (data.name || 'Anonymous Analyst').trim();
  const cleanRole = (data.role || 'Security Practitioner').trim();
  const cleanOrg = (data.organization || '').trim() || undefined;
  const ratingNum = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5)));
  const cleanFeedback = (data.feedback || '').trim();
  const cleanMetric = (data.impactMetric || '').trim() || undefined;
  const createdAt = new Date().toISOString();

  const id = `rev_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
  
  // Deterministic SHA-256 verification hash
  const payloadToHash = `${id}|${cleanName}|${cleanRole}|${cleanFeedback}|${createdAt}`;
  const verificationDigest = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  const newTestimonial: UserTestimonial = {
    id,
    name: cleanName,
    role: cleanRole,
    organization: cleanOrg,
    rating: ratingNum,
    feedback: cleanFeedback,
    impactMetric: cleanMetric,
    verified: true,
    verificationDigest,
    createdAt
  };

  inMemoryTestimonials.unshift(newTestimonial);
  saveTestimonialsToDisk(inMemoryTestimonials);

  return newTestimonial;
}

export const getTestimonials = getLiveTestimonials;
export const addTestimonial = addLiveTestimonial;
export const moderateTestimonial = updateModerationStatus;
