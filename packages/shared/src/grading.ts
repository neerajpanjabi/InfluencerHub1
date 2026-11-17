/**
 * InfluenceHub Performance Grading Engine.
 *
 * Produces an explainable 0–100 score from *verified-weighted* social metrics.
 * The grade is a PERFORMANCE indicator only. It never implies identity verification,
 * professional qualification or account ownership — those are separate badges.
 */

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D' | 'NOT_RATED';
export type MetricVerification =
  | 'API_VERIFIED'
  | 'MANUALLY_SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'UNAVAILABLE'
  | 'EXPIRED'
  | 'SUSPICIOUS';

export type ComponentKey = 'reelViews' | 'storyViews' | 'followers' | 'engagement' | 'audienceQuality' | 'consistency';

export interface Range {
  floor: number;
  ceiling: number;
}

export interface GradingConfig {
  weights: Record<ComponentKey, number>;
  thresholds: { S: number; A: number; B: number; C: number };
  /** Minimum share (0..1) of total weight that must be backed by usable data. */
  minCoverage: number;
  /** At least one API-verified metric is required to be rated at all. */
  requireApiVerified: boolean;
  /** Minimum posts an average must be computed over. */
  minSamplePosts: number;
  verificationWeights: Record<MetricVerification, number>;
  freshness: { fullWeightDays: number; zeroWeightDays: number };
  normalization: {
    INSTAGRAM: { followers: Range; reelViews: Range; storyViews: Range };
    TIKTOK: { followers: Range; videoViews: Range };
    engagementTarget: number; // % engagement that earns 100
  };
  outliers: { maxViewsToFollowers: number; maxEngagementRate: number };
  /** Category scaling of normalisation ceilings — niche categories have smaller audiences. */
  categoryScale: Record<string, number>;
  consistency: { targetPostsPer30Days: number };
}

export const DEFAULT_GRADING_CONFIG: GradingConfig = {
  weights: { reelViews: 25, storyViews: 20, followers: 15, engagement: 15, audienceQuality: 15, consistency: 10 },
  thresholds: { S: 90, A: 80, B: 65, C: 45 },
  minCoverage: 0.5,
  requireApiVerified: true,
  minSamplePosts: 5,
  verificationWeights: {
    API_VERIFIED: 1,
    MANUALLY_SUBMITTED: 0.5,
    PENDING_VERIFICATION: 0.25,
    UNAVAILABLE: 0,
    EXPIRED: 0,
    SUSPICIOUS: 0,
  },
  freshness: { fullWeightDays: 30, zeroWeightDays: 120 },
  normalization: {
    INSTAGRAM: {
      followers: { floor: 1_000, ceiling: 2_000_000 },
      reelViews: { floor: 300, ceiling: 1_000_000 },
      storyViews: { floor: 100, ceiling: 150_000 },
    },
    TIKTOK: {
      followers: { floor: 1_000, ceiling: 3_000_000 },
      videoViews: { floor: 300, ceiling: 1_500_000 },
    },
    engagementTarget: 6,
  },
  outliers: { maxViewsToFollowers: 25, maxEngagementRate: 35 },
  categoryScale: { 'medical-healthcare': 0.4, 'education-schools': 0.5, 'finance-professional-services': 0.5, 'real-estate': 0.6 },
  consistency: { targetPostsPer30Days: 8 },
};

export interface MetricInput {
  value: number;
  verification: MetricVerification;
  collectedAt: Date | string;
  sampleSize?: number | null;
}

export interface PlatformMetrics {
  followers?: MetricInput;
  avgReelViews?: MetricInput; // Instagram reels
  avgStoryViews?: MetricInput; // Instagram stories
  avgVideoViews?: MetricInput; // TikTok videos
  engagementRate?: MetricInput; // percent
  postsLast30Days?: number;
  viewsCoefficientOfVariation?: number; // stddev/mean of views across recent posts
}

export interface GradingInput {
  instagram?: PlatformMetrics;
  tiktok?: PlatformMetrics;
  /** Share (0..1) of audience located in the target market (UAE), when authorised. */
  audienceTargetMarketShare?: MetricInput;
  primaryCategorySlug?: string | null;
  now?: Date;
}

export interface ComponentResult {
  key: ComponentKey;
  weight: number;
  rawValue: number | null;
  normalized: number | null; // 0..100
  confidence: number; // 0..1 (verification x freshness)
  effectiveWeight: number;
  source: string | null;
  note?: string;
}

export interface GradingResult {
  score: number | null;
  grade: GradeLetter;
  coverage: number;
  components: ComponentResult[];
  flags: string[];
  reason?: string;
}

function daysBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

export function freshnessFactor(collectedAt: Date | string, now: Date, cfg: GradingConfig['freshness']): number {
  const age = daysBetween(new Date(collectedAt), now);
  if (age <= cfg.fullWeightDays) return 1;
  if (age >= cfg.zeroWeightDays) return 0;
  return 1 - (age - cfg.fullWeightDays) / (cfg.zeroWeightDays - cfg.fullWeightDays);
}

/** Log-scale normalisation between floor and ceiling, clamped to 0..100. */
export function logNormalize(value: number, range: Range, scale = 1): number {
  const floor = Math.max(1, range.floor * scale);
  const ceiling = Math.max(floor + 1, range.ceiling * scale);
  if (value <= floor) return 0;
  if (value >= ceiling) return 100;
  return (100 * (Math.log(value) - Math.log(floor))) / (Math.log(ceiling) - Math.log(floor));
}

export function gradeFromScore(score: number, t: GradingConfig['thresholds']): GradeLetter {
  if (score >= t.S) return 'S';
  if (score >= t.A) return 'A';
  if (score >= t.B) return 'B';
  if (score >= t.C) return 'C';
  return 'D';
}

function confidenceOf(m: MetricInput | undefined, cfg: GradingConfig, now: Date, needsSample = false) {
  if (!m) return 0;
  let c = cfg.verificationWeights[m.verification] ?? 0;
  c *= freshnessFactor(m.collectedAt, now, cfg.freshness);
  if (needsSample && (m.sampleSize ?? 0) < cfg.minSamplePosts) c = 0;
  return c;
}

export function computeGrade(input: GradingInput, cfg: GradingConfig = DEFAULT_GRADING_CONFIG): GradingResult {
  const now = input.now ?? new Date();
  const flags: string[] = [];
  const scale = (input.primaryCategorySlug && cfg.categoryScale[input.primaryCategorySlug]) || 1;
  const ig = input.instagram ?? {};
  const tt = input.tiktok ?? {};
  const components: ComponentResult[] = [];

  const push = (key: ComponentKey, best: { raw: number; norm: number; conf: number; source: string; note?: string } | null) => {
    const weight = cfg.weights[key];
    components.push({
      key,
      weight,
      rawValue: best ? best.raw : null,
      normalized: best ? Math.round(best.norm * 100) / 100 : null,
      confidence: best ? Math.round(best.conf * 1000) / 1000 : 0,
      effectiveWeight: best ? weight * best.conf : 0,
      source: best ? best.source : null,
      note: best?.note,
    });
  };

  const totalFollowers = (ig.followers?.value ?? 0) + (tt.followers?.value ?? 0);

  // Outlier detection: views wildly exceeding followers usually indicates purchased views or bad data.
  const isOutlierViews = (views: number | undefined, followers: number | undefined) =>
    views != null && followers != null && followers > 0 && views / followers > cfg.outliers.maxViewsToFollowers;

  // ── Short-form views (Instagram Reels / TikTok videos): best verified-weighted platform
  const viewCandidates: Array<{ raw: number; norm: number; conf: number; source: string; note?: string }> = [];
  if (ig.avgReelViews) {
    if (isOutlierViews(ig.avgReelViews.value, ig.followers?.value)) flags.push('INSTAGRAM_REEL_VIEWS_OUTLIER');
    else
      viewCandidates.push({
        raw: ig.avgReelViews.value,
        norm: logNormalize(ig.avgReelViews.value, cfg.normalization.INSTAGRAM.reelViews, scale),
        conf: confidenceOf(ig.avgReelViews, cfg, now, true),
        source: `INSTAGRAM:${ig.avgReelViews.verification}`,
      });
  }
  if (tt.avgVideoViews) {
    if (isOutlierViews(tt.avgVideoViews.value, tt.followers?.value)) flags.push('TIKTOK_VIDEO_VIEWS_OUTLIER');
    else
      viewCandidates.push({
        raw: tt.avgVideoViews.value,
        norm: logNormalize(tt.avgVideoViews.value, cfg.normalization.TIKTOK.videoViews, scale),
        conf: confidenceOf(tt.avgVideoViews, cfg, now, true),
        source: `TIKTOK:${tt.avgVideoViews.verification}`,
      });
  }
  push('reelViews', pickBest(viewCandidates));

  // ── Story views (Instagram only; not available via TikTok APIs)
  if (ig.avgStoryViews && isOutlierViews(ig.avgStoryViews.value, ig.followers?.value)) {
    flags.push('INSTAGRAM_STORY_VIEWS_OUTLIER');
    push('storyViews', null);
  } else {
    push(
      'storyViews',
      ig.avgStoryViews
        ? {
            raw: ig.avgStoryViews.value,
            norm: logNormalize(ig.avgStoryViews.value, cfg.normalization.INSTAGRAM.storyViews, scale),
            conf: confidenceOf(ig.avgStoryViews, cfg, now, false),
            source: `INSTAGRAM:${ig.avgStoryViews.verification}`,
          }
        : null,
    );
  }

  // ── Followers: combined reach across platforms, confidence = weighted mean of sources
  const fCands: Array<{ raw: number; norm: number; conf: number; source: string }> = [];
  if (ig.followers)
    fCands.push({
      raw: ig.followers.value,
      norm: logNormalize(ig.followers.value, cfg.normalization.INSTAGRAM.followers, scale),
      conf: confidenceOf(ig.followers, cfg, now),
      source: `INSTAGRAM:${ig.followers.verification}`,
    });
  if (tt.followers)
    fCands.push({
      raw: tt.followers.value,
      norm: logNormalize(tt.followers.value, cfg.normalization.TIKTOK.followers, scale),
      conf: confidenceOf(tt.followers, cfg, now),
      source: `TIKTOK:${tt.followers.verification}`,
    });
  if (fCands.length) {
    const best = pickBest(fCands)!;
    // Small cross-platform bonus (max +5) for a second meaningful audience
    const second = fCands.length > 1 ? Math.min(...fCands.map((c) => c.norm)) : 0;
    push('followers', { ...best, raw: totalFollowers, norm: Math.min(100, best.norm + second * 0.05) });
  } else push('followers', null);

  // ── Engagement rate (%)
  const eCands: Array<{ raw: number; norm: number; conf: number; source: string }> = [];
  for (const [name, m] of [['INSTAGRAM', ig.engagementRate], ['TIKTOK', tt.engagementRate]] as const) {
    if (!m) continue;
    if (m.value > cfg.outliers.maxEngagementRate) {
      flags.push(`${name}_ENGAGEMENT_OUTLIER`);
      continue;
    }
    eCands.push({
      raw: m.value,
      norm: Math.min(100, (m.value / cfg.normalization.engagementTarget) * 100),
      conf: confidenceOf(m, cfg, now, true),
      source: `${name}:${m.verification}`,
    });
  }
  push('engagement', pickBest(eCands));

  // ── Audience quality: share of audience in target market (requires authorised insights)
  const aq = input.audienceTargetMarketShare;
  push(
    'audienceQuality',
    aq
      ? {
          raw: aq.value,
          // 60%+ in-market audience earns full marks
          norm: Math.min(100, (aq.value / 0.6) * 100),
          conf: confidenceOf(aq, cfg, now),
          source: `AUDIENCE:${aq.verification}`,
        }
      : null,
  );

  // ── Consistency: posting cadence + view stability (derived from API-fetched posts)
  const cadenceSrc = ig.postsLast30Days != null ? ig : tt.postsLast30Days != null ? tt : null;
  if (cadenceSrc && cadenceSrc.postsLast30Days != null) {
    const cadence = Math.min(100, (cadenceSrc.postsLast30Days / cfg.consistency.targetPostsPer30Days) * 100);
    const cv = cadenceSrc.viewsCoefficientOfVariation;
    const stability = cv == null ? cadence : Math.max(0, 100 - Math.min(100, cv * 50));
    const viewsMetric = cadenceSrc === ig ? ig.avgReelViews : tt.avgVideoViews;
    push('consistency', {
      raw: cadenceSrc.postsLast30Days,
      norm: cadence * 0.6 + stability * 0.4,
      conf: viewsMetric ? confidenceOf(viewsMetric, cfg, now) : 0.25,
      source: cadenceSrc === ig ? 'INSTAGRAM:POSTS' : 'TIKTOK:POSTS',
    });
  } else push('consistency', null);

  const totalWeight = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
  const effective = components.reduce((a, c) => a + c.effectiveWeight, 0);
  const coverage = totalWeight === 0 ? 0 : effective / totalWeight;
  const hasApiVerified = [ig.followers, ig.avgReelViews, ig.avgStoryViews, ig.engagementRate, tt.followers, tt.avgVideoViews, tt.engagementRate]
    .some((m) => m?.verification === 'API_VERIFIED');

  const roundedCoverage = Math.round(coverage * 1000) / 1000;
  if (cfg.requireApiVerified && !hasApiVerified) {
    return { score: null, grade: 'NOT_RATED', coverage: roundedCoverage, components, flags, reason: 'NO_API_VERIFIED_DATA' };
  }
  if (coverage < cfg.minCoverage) {
    return { score: null, grade: 'NOT_RATED', coverage: roundedCoverage, components, flags, reason: 'INSUFFICIENT_DATA' };
  }
  const weighted = components.reduce((a, c) => a + (c.normalized ?? 0) * c.effectiveWeight, 0) / effective;
  const score = Math.round(weighted * 100) / 100;
  return { score, grade: gradeFromScore(score, cfg.thresholds), coverage: roundedCoverage, components, flags };
}

function pickBest<T extends { norm: number; conf: number }>(cands: T[]): T | null {
  const usable = cands.filter((c) => c.conf > 0);
  if (!usable.length) return null;
  return usable.reduce((a, b) => (b.norm * b.conf > a.norm * a.conf ? b : a));
}

export function mergeGradingConfig(partial: Partial<GradingConfig> | null | undefined): GradingConfig {
  if (!partial) return DEFAULT_GRADING_CONFIG;
  return {
    ...DEFAULT_GRADING_CONFIG,
    ...partial,
    weights: { ...DEFAULT_GRADING_CONFIG.weights, ...(partial.weights ?? {}) },
    thresholds: { ...DEFAULT_GRADING_CONFIG.thresholds, ...(partial.thresholds ?? {}) },
    verificationWeights: { ...DEFAULT_GRADING_CONFIG.verificationWeights, ...(partial.verificationWeights ?? {}) },
    freshness: { ...DEFAULT_GRADING_CONFIG.freshness, ...(partial.freshness ?? {}) },
    normalization: { ...DEFAULT_GRADING_CONFIG.normalization, ...(partial.normalization ?? {}) },
    outliers: { ...DEFAULT_GRADING_CONFIG.outliers, ...(partial.outliers ?? {}) },
    categoryScale: { ...DEFAULT_GRADING_CONFIG.categoryScale, ...(partial.categoryScale ?? {}) },
    consistency: { ...DEFAULT_GRADING_CONFIG.consistency, ...(partial.consistency ?? {}) },
  };
}
