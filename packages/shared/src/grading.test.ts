import { describe, it, expect } from 'vitest';
import { computeGrade, gradeFromScore, logNormalize, freshnessFactor, DEFAULT_GRADING_CONFIG, mergeGradingConfig } from './grading';

const now = new Date('2026-11-01T00:00:00Z');
const fresh = '2026-10-25T00:00:00Z';
const v = (value: number, verification: any = 'API_VERIFIED', sampleSize = 12, collectedAt = fresh) => ({ value, verification, collectedAt, sampleSize });

describe('grading engine', () => {
  it('maps scores to grade bands', () => {
    const t = DEFAULT_GRADING_CONFIG.thresholds;
    expect(gradeFromScore(95, t)).toBe('S');
    expect(gradeFromScore(90, t)).toBe('S');
    expect(gradeFromScore(85, t)).toBe('A');
    expect(gradeFromScore(70, t)).toBe('B');
    expect(gradeFromScore(50, t)).toBe('C');
    expect(gradeFromScore(10, t)).toBe('D');
  });

  it('log-normalises within range', () => {
    expect(logNormalize(500, { floor: 1000, ceiling: 1_000_000 })).toBe(0);
    expect(logNormalize(2_000_000, { floor: 1000, ceiling: 1_000_000 })).toBe(100);
    expect(Math.round(logNormalize(31623, { floor: 1000, ceiling: 1_000_000 }))).toBe(50);
  });

  it('returns NOT_RATED with no API-verified data', () => {
    const r = computeGrade({ instagram: { followers: v(50000, 'MANUALLY_SUBMITTED'), avgReelViews: v(20000, 'MANUALLY_SUBMITTED') }, now });
    expect(r.grade).toBe('NOT_RATED');
    expect(r.score).toBeNull();
    expect(r.reason).toBe('NO_API_VERIFIED_DATA');
  });

  it('returns NOT_RATED when coverage is insufficient', () => {
    const r = computeGrade({ instagram: { followers: v(50000) }, now });
    expect(r.grade).toBe('NOT_RATED');
    expect(r.reason).toBe('INSUFFICIENT_DATA');
  });

  it('grades a strong, fully verified creator highly', () => {
    const r = computeGrade(
      {
        instagram: {
          followers: v(850000),
          avgReelViews: v(600000),
          avgStoryViews: v(90000),
          engagementRate: v(6.5),
          postsLast30Days: 10,
          viewsCoefficientOfVariation: 0.3,
        },
        audienceTargetMarketShare: v(0.7),
        now,
      },
    );
    expect(r.grade === 'S' || r.grade === 'A').toBe(true);
    expect(r.score).toBeGreaterThan(80);
    expect(r.coverage).toBeGreaterThan(0.9);
    expect(r.components).toHaveLength(6);
  });

  it('grades a small creator lower', () => {
    const r = computeGrade({ instagram: { followers: v(4000), avgReelViews: v(900), avgStoryViews: v(300), engagementRate: v(1.2), postsLast30Days: 2 }, now });
    expect(['C', 'D']).toContain(r.grade);
  });

  it('flags and excludes outlier views', () => {
    const r = computeGrade({ instagram: { followers: v(1000), avgReelViews: v(900000), engagementRate: v(4), avgStoryViews: v(400) }, now });
    expect(r.flags).toContain('INSTAGRAM_REEL_VIEWS_OUTLIER');
    expect(r.components.find((c) => c.key === 'reelViews')!.normalized).toBeNull();
  });

  it('ignores averages below minimum sample size', () => {
    const r = computeGrade({ instagram: { followers: v(50000), avgReelViews: v(20000, 'API_VERIFIED', 2), engagementRate: v(3, 'API_VERIFIED', 2) }, now });
    expect(r.components.find((c) => c.key === 'reelViews')!.effectiveWeight).toBe(0);
  });

  it('decays stale data', () => {
    expect(freshnessFactor('2026-10-30T00:00:00Z', now, DEFAULT_GRADING_CONFIG.freshness)).toBe(1);
    expect(freshnessFactor('2026-01-01T00:00:00Z', now, DEFAULT_GRADING_CONFIG.freshness)).toBe(0);
    const mid = freshnessFactor('2026-08-18T00:00:00Z', now, DEFAULT_GRADING_CONFIG.freshness);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('weights verified data above manual data', () => {
    const verified = computeGrade({ instagram: { followers: v(100000), avgReelViews: v(50000), engagementRate: v(3), avgStoryViews: v(8000, 'MANUALLY_SUBMITTED') }, now });
    const storyComp = verified.components.find((c) => c.key === 'storyViews')!;
    expect(storyComp.confidence).toBe(0.5);
  });

  it('applies category scaling so niche creators are compared fairly', () => {
    const base = { instagram: { followers: v(20000), avgReelViews: v(8000), engagementRate: v(4), avgStoryViews: v(2000) }, now };
    const general = computeGrade(base);
    const medical = computeGrade({ ...base, primaryCategorySlug: 'medical-healthcare' });
    expect(medical.score!).toBeGreaterThan(general.score!);
  });

  it('merges partial admin config', () => {
    const cfg = mergeGradingConfig({ thresholds: { S: 95, A: 85, B: 70, C: 50 } } as any);
    expect(cfg.thresholds.S).toBe(95);
    expect(cfg.weights.reelViews).toBe(25);
  });
});
