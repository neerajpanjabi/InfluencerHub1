import { describe, it, expect } from 'vitest';
import {
  suggestPrice, effectivePrice, matchBenchmark, evaluateContact, DEFAULT_CONTACT_SETTINGS, isEntitlementActive,
  canTransition, allowedTransitions, hasPermission, permissionsForRoles, influencerSearchSchema, toSearchQuery,
  parseQuery, uaePhoneSchema, passwordSchema, entitlementExpiry,
} from './index';

describe('pricing engine', () => {
  it('uses a formula when no benchmark matches and labels it as sample', () => {
    const s = suggestPrice({ serviceKey: 'ig_reel', platform: 'INSTAGRAM', avgViews: 50000, grade: 'B' });
    expect(s.basis).toBe('FORMULA');
    expect(s.isSampleData).toBe(true);
    expect(s.suggested).toBeGreaterThan(0);
    expect(s.low).toBeLessThanOrEqual(s.suggested);
    expect(s.high).toBeGreaterThanOrEqual(s.suggested);
  });
  it('prefers the most specific matching benchmark', () => {
    const rows = [
      { id: 'generic', platform: 'INSTAGRAM' as const, minRate: 500, medianRate: 1000, maxRate: 2000, isSample: true, researchSource: 'sample' },
      { id: 'specific', platform: 'INSTAGRAM' as const, serviceKey: 'ig_reel', followersMin: 10000, followersMax: 100000, minRate: 1500, medianRate: 2500, maxRate: 4000, isSample: true, researchSource: 'sample' },
    ];
    expect(matchBenchmark(rows, { serviceKey: 'ig_reel', platform: 'INSTAGRAM', followers: 50000 })!.id).toBe('specific');
    expect(matchBenchmark(rows, { serviceKey: 'ig_reel', platform: 'INSTAGRAM', followers: 500000 })!.id).toBe('generic');
    const s = suggestPrice({ serviceKey: 'ig_reel', platform: 'INSTAGRAM', followers: 50000, grade: 'B' }, rows);
    expect(s.basis).toBe('BENCHMARK');
    expect(s.benchmarkId).toBe('specific');
    expect(s.suggested).toBe(2500);
  });
  it('increases price for higher grades, usage rights and exclusivity', () => {
    const b = suggestPrice({ serviceKey: 'ig_reel', platform: 'INSTAGRAM', avgViews: 50000, grade: 'B' }).suggested;
    const s = suggestPrice({ serviceKey: 'ig_reel', platform: 'INSTAGRAM', avgViews: 50000, grade: 'S' }).suggested;
    const u = suggestPrice({ serviceKey: 'ig_reel', platform: 'INSTAGRAM', avgViews: 50000, grade: 'B', usageRightsMonths: 3, exclusivityMonths: 2 }).suggested;
    expect(s).toBeGreaterThan(b);
    expect(u).toBeGreaterThan(b);
  });
  it('applies promo price only while valid', () => {
    const now = new Date('2026-11-01');
    expect(effectivePrice(1000, 800, '2026-12-01', now)).toBe(800);
    expect(effectivePrice(1000, 800, '2026-10-01', now)).toBe(1000);
    expect(effectivePrice(1000, 1200, null, now)).toBe(1000);
  });
});

describe('contact entitlements', () => {
  const base = { entitlements: [], influencerContactable: true, blocked: false, businessActive: true, freeContactsUsed: 0, adminFreeCredits: 0, contactsUnlockedToday: 0, settings: DEFAULT_CONTACT_SETTINGS };
  it('requires payment when no entitlement exists', () => {
    const d = evaluateContact({ ...base, freeContactsUsed: 1 });
    expect(d).toEqual({ allowed: false, reason: 'PAYMENT_REQUIRED', fee: '49.00', freeAllowanceAvailable: false });
  });
  it('reports free allowance availability', () => {
    const d = evaluateContact(base);
    expect(d.allowed).toBe(false);
    expect((d as any).freeAllowanceAvailable).toBe(true);
  });
  it('allows contact with an active entitlement (no double charge)', () => {
    expect(evaluateContact({ ...base, entitlements: [{ source: 'PURCHASE', expiresAt: '2099-01-01' }] })).toEqual({ allowed: true, via: 'PURCHASE' });
  });
  it('rejects expired or revoked entitlements', () => {
    expect(isEntitlementActive({ source: 'PURCHASE', expiresAt: '2000-01-01' })).toBe(false);
    expect(isEntitlementActive({ source: 'ADMIN_GRANT', revokedAt: '2026-01-01' })).toBe(false);
  });
  it('blocks when blocked / not contactable / limit reached', () => {
    expect(evaluateContact({ ...base, blocked: true })).toMatchObject({ reason: 'BLOCKED' });
    expect(evaluateContact({ ...base, influencerContactable: false })).toMatchObject({ reason: 'INFLUENCER_NOT_CONTACTABLE' });
    expect(evaluateContact({ ...base, contactsUnlockedToday: 25 })).toMatchObject({ reason: 'DAILY_LIMIT_REACHED' });
    expect(evaluateContact({ ...base, businessActive: false })).toMatchObject({ reason: 'BUSINESS_NOT_ACTIVE' });
  });
  it('computes access expiry', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(entitlementExpiry(DEFAULT_CONTACT_SETTINGS, from)!.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(entitlementExpiry({ ...DEFAULT_CONTACT_SETTINGS, accessDurationDays: null }, from)).toBeNull();
  });
});

describe('campaign state machine', () => {
  it('permits valid transitions for the right actor only', () => {
    expect(canTransition('CONFIRMED', 'IN_PROGRESS', 'INFLUENCER')).toBe(true);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS', 'BUSINESS')).toBe(false);
    expect(canTransition('CONTENT_SUBMITTED', 'APPROVED', 'BUSINESS')).toBe(true);
    expect(canTransition('CONTENT_SUBMITTED', 'APPROVED', 'INFLUENCER')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'CONFIRMED', 'BUSINESS')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'CONFIRMED', 'SYSTEM')).toBe(true);
  });
  it('does not allow leaving terminal states', () => {
    expect(allowedTransitions('COMPLETED', 'ADMIN')).toEqual([]);
    expect(canTransition('CANCELLED', 'IN_PROGRESS', 'ADMIN')).toBe(false);
  });
  it('lets admins resolve disputes', () => {
    expect(canTransition('DISPUTED', 'COMPLETED', 'ADMIN')).toBe(true);
    expect(canTransition('DISPUTED', 'COMPLETED', 'BUSINESS')).toBe(false);
  });
});

describe('permissions', () => {
  it('restricts admin roles to least privilege', () => {
    expect(hasPermission(['FINANCE_ADMIN'], 'refunds.manage')).toBe(true);
    expect(hasPermission(['FINANCE_ADMIN'], 'categories.manage')).toBe(false);
    expect(hasPermission(['CONTENT_MODERATOR'], 'payments.read')).toBe(false);
    expect(hasPermission(['SUPER_ADMIN'], ['admins.manage', 'audit.read'])).toBe(true);
    expect(hasPermission(['BUSINESS'], 'users.read')).toBe(false);
    expect(permissionsForRoles([]).size).toBe(0);
  });
});

describe('search filters', () => {
  it('parses query strings into typed filters', () => {
    const p = influencerSearchSchema.parse({ platform: 'INSTAGRAM,TIKTOK', minFollowers: '20000', emirate: 'DUBAI', page: '2', verifiedOnly: 'true' });
    expect(p.platform).toEqual(['INSTAGRAM', 'TIKTOK']);
    expect(p.minFollowers).toBe(20000);
    expect(p.page).toBe(2);
    expect(p.verifiedOnly).toBe(true);
    expect(p.sort).toBe('relevance');
  });
  it('rejects invalid enums and out-of-range pages', () => {
    expect(() => influencerSearchSchema.parse({ emirate: 'LONDON' })).toThrow();
    expect(() => influencerSearchSchema.parse({ pageSize: '1000' })).toThrow();
  });
  it('round-trips to query string', () => {
    expect(toSearchQuery({ category: ['dermatology'], emirate: ['DUBAI'], page: 1, sort: 'relevance' })).toBe('category=dermatology&emirate=DUBAI');
  });
});

describe('AI query parser', () => {
  it('parses dermatologists in Dubai with count', () => {
    const q = parseQuery('Find 10 Dubai-based dermatologists for a clinic promotion.');
    expect(q.specialities).toContain('dermatology');
    expect(q.emirates).toEqual(['DUBAI']);
    expect(q.limit).toBe(10);
  });
  it('parses follower thresholds and food category', () => {
    const q = parseQuery('Find food influencers in Sharjah with at least 20,000 followers');
    expect(q.categories).toContain('restaurants-food');
    expect(q.emirates).toEqual(['SHARJAH']);
    expect(q.minFollowers).toBe(20000);
  });
  it('parses language and affordability', () => {
    const q = parseQuery('Find Malayalam-speaking creators in Dubai with affordable Reel prices.');
    expect(q.languages).toContain('ml');
    expect(q.budgetTier).toBe('affordable');
    expect(q.platforms).toContain('INSTAGRAM');
    expect(q.serviceTypes).toContain('ig_reel');
  });
  it('parses gender and jewellery', () => {
    const q = parseQuery('Find female creators who can promote a jewellery store.');
    expect(q.gender).toBe('FEMALE');
    expect(q.categories).toContain('jewellery-luxury');
  });
  it('parses TikTok + supermarket', () => {
    const q = parseQuery('Find TikTok influencers for a supermarket opening.');
    expect(q.platforms).toEqual(['TIKTOK']);
    expect(q.categories).toContain('retail-hypermarkets');
  });
  it('parses luxury villas real estate', () => {
    expect(parseQuery('Find real estate creators specializing in luxury villas.').categories).toContain('real-estate');
  });
  it('parses k-suffix and budget', () => {
    const q = parseQuery('instagram beauty creators 50k+ followers under 3000 AED');
    expect(q.minFollowers).toBe(50000);
    expect(q.maxBudget).toBe(3000);
    expect(q.categories).toContain('beauty-salons');
  });
  it('parses Arabic queries', () => {
    const q = parseQuery('ابحث عن مؤثرين في أبوظبي في مجال المطاعم لديهم أكثر من ٢٠ ألف متابع');
    expect(q.detectedLocale).toBe('ar');
    expect(q.emirates).toContain('ABU_DHABI');
    expect(q.categories).toContain('restaurants-food');
    expect(q.minFollowers).toBe(20000);
  });
  it('parses Arabic dermatology + TikTok', () => {
    const q = parseQuery('أطباء جلدية في دبي على تيك توك');
    expect(q.specialities).toContain('dermatology');
    expect(q.emirates).toContain('DUBAI');
    expect(q.platforms).toContain('TIKTOK');
  });
});

describe('UAE validation', () => {
  it('normalises UAE phone numbers', () => {
    expect(uaePhoneSchema.parse('050 123 4567')).toBe('+971501234567');
    expect(uaePhoneSchema.parse('00971501234567')).toBe('+971501234567');
    expect(uaePhoneSchema.parse('+97142345678')).toBe('+97142345678');
    expect(() => uaePhoneSchema.parse('+44 7700 900123')).toThrow();
  });
  it('enforces password complexity', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false);
    expect(passwordSchema.safeParse('Str0ngPassword!').success).toBe(true);
  });
});
