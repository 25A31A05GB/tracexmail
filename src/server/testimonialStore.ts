import fs from 'fs';
import path from 'path';
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
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'user_testimonials.json');

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
  } catch (err) {
    console.warn('[testimonialStore] Could not read user_testimonials.json from disk:', err);
  }
  // No fake reviews: Return empty array if no user has posted yet
  return [];
}

function saveTestimonialsToDisk(testimonials: UserTestimonial[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(testimonials, null, 2), 'utf-8');
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

  const id = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
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
