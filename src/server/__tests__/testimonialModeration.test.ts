import { describe, it, expect, beforeEach } from 'vitest';
import {
  addLiveTestimonial,
  reportTestimonial,
  updateModerationStatus,
  getLiveTestimonials
} from '../testimonialStore';

describe('User Testimonials & Public Post Moderation', () => {
  it('adds an authentic user testimonial with cryptographic digest and live status', () => {
    const post = addLiveTestimonial({
      name: 'Agent Mulder',
      role: 'Forensic Lead',
      organization: 'CyberGov',
      rating: 5,
      feedback: 'Excellent email header parsing and RFC 822 decoding capabilities.',
      impactMetric: '-75% Triage Time'
    });

    expect(post).toBeDefined();
    expect(post.id).toMatch(/^rev_/);
    expect(post.verified).toBe(true);
    expect(post.verificationDigest).toBeDefined();
    expect(post.feedback).toBe('Excellent email header parsing and RFC 822 decoding capabilities.');
    expect(post.moderationStatus).not.toBe('hidden');
  });

  it('allows users to report inappropriate content with a flag and custom reason', () => {
    const post = addLiveTestimonial({
      name: 'Suspect User',
      role: 'Spammer',
      rating: 1,
      feedback: 'Buy cheap watches and fake pills at spam-site.com!'
    });

    const reported = reportTestimonial(post.id, 'Spam, advertising, or unsolicited promotion');
    expect(reported).not.toBeNull();
    expect(reported?.isReported).toBe(true);
    expect(reported?.reportCount).toBe(1);
    expect(reported?.reportReason).toBe('Spam, advertising, or unsolicited promotion');
    expect(reported?.reportedAt).toBeDefined();
  });

  it('allows administrators to toggle hide or approve posts from the public feed', () => {
    const post = addLiveTestimonial({
      name: 'Disputed Reviewer',
      role: 'Analyst',
      rating: 3,
      feedback: 'This post is under active review.'
    });

    // Administrator hides post
    const hidden = updateModerationStatus(post.id, 'hidden');
    expect(hidden?.moderationStatus).toBe('hidden');

    // Public feed excludes hidden post
    const publicList = getLiveTestimonials(false);
    expect(publicList.some(p => p.id === post.id)).toBe(false);

    // Admin view includes hidden post
    const adminList = getLiveTestimonials(true);
    expect(adminList.some(p => p.id === post.id)).toBe(true);

    // Administrator approves post back to live
    const approved = updateModerationStatus(post.id, 'approved');
    expect(approved?.moderationStatus).toBe('approved');

    // Public feed now includes approved post
    const restoredPublicList = getLiveTestimonials(false);
    expect(restoredPublicList.some(p => p.id === post.id)).toBe(true);
  });
});
