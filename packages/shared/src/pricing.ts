/**
 * Pricing recommendation engine.
 *
 * Suggests a price range for a creator's service. Uses a matching UAE benchmark row when one
 * exists (benchmarks may be SAMPLE data — the result carries `isSampleData`), otherwise falls
 * back to a configurable CPM-style formula. The suggestion is advisory only: the creator's own
 * price / accepted quotation always determines the booking price.
 */
import type { GradeLetter } from './grading';

export type PlatformKey = 'INSTAGRAM' | 'TIKTOK' | 'CROSS_PLATFORM' | 'OFFLINE';

export interface BenchmarkRow {
  id: string;
  platform: PlatformKey;
  serviceKey?: string | null;
  categorySlug?: string | null;
  emirate?: string | null;
  grade?: GradeLetter | null;
  followersMin?: number | null;
  followersMax?: number | null;
  minRate: number;
  medianRate: number;
  maxRate: number;
  isSample: boolean;
  researchSource: string;
}

export interface PricingConfig {
  /** AED per 1,000 expected views — SAMPLE defaults, editable by admins. */
  cpmByPlatform: Record<PlatformKey, number>;
  /** Base flat fee (AED) per service key when views are unknown. */
  baseFeeByService: Record<string, number>;
  /** How many "view units" each service represents relative to one short video. */
  serviceViewMultiplier: Record<string, number>;
  gradeFactor: Record<GradeLetter, number>;
  categoryFactor: Record<string, number>;
  emirateFactor: Record<string, number>;
  /** Premium when the creator's audience is concentrated in the UAE. */
  inMarketAudiencePremium: number;
  languagePremium: Record<string, number>;
  usageRightsPerMonth: number; // +% per month of paid usage rights
  exclusivityPerMonth: number; // +% per month of category exclusivity
  minimumPrice: number;
  spread: number; // +/- range around suggestion when using formula
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  cpmByPlatform: { INSTAGRAM: 45, TIKTOK: 30, CROSS_PLATFORM: 40, OFFLINE: 0 },
  baseFeeByService: {
    ig_single_story: 400,
    ig_story_3: 1000,
    ig_story_5: 1500,
    ig_reel: 1800,
    ig_reel_story: 2100,
    ig_reel_story_3: 2600,
    ig_reel_story_5: 3000,
    ig_carousel: 1400,
    ig_feed_post: 1200,
    ig_live: 2000,
    ig_event_coverage: 3000,
    ig_monthly_promotion: 9000,
    tt_video: 1600,
    tt_product_review: 1700,
    tt_live: 1800,
    tt_campaign_package: 6000,
    x_ig_tt_video: 3000,
    x_reel_tt_video: 3000,
    x_story_tt_video: 2000,
    x_multi_platform: 6500,
    ugc_video: 1200,
    product_photography: 1000,
    product_review: 1200,
    store_visit: 1500,
    restaurant_visit: 1200,
    event_attendance: 1800,
    product_demo: 1400,
    monthly_retainer: 12000,
    brand_ambassador: 25000,
    content_production: 2500,
  },
  serviceViewMultiplier: {
    ig_single_story: 0.25,
    ig_story_3: 0.65,
    ig_story_5: 0.95,
    ig_reel: 1,
    ig_reel_story: 1.2,
    ig_reel_story_3: 1.5,
    ig_reel_story_5: 1.75,
    ig_carousel: 0.7,
    ig_feed_post: 0.6,
    ig_live: 1,
    ig_event_coverage: 1.8,
    ig_monthly_promotion: 5,
    tt_video: 1,
    tt_product_review: 1.1,
    tt_live: 1,
    tt_campaign_package: 3.5,
    x_ig_tt_video: 1.8,
    x_reel_tt_video: 1.8,
    x_story_tt_video: 1.2,
    x_multi_platform: 3.5,
  },
  gradeFactor: { S: 1.35, A: 1.2, B: 1.0, C: 0.85, D: 0.7, NOT_RATED: 0.9 },
  categoryFactor: { 'medical-healthcare': 1.3, 'real-estate': 1.25, 'jewellery-luxury': 1.3, 'finance-professional-services': 1.2, 'automotive': 1.15 },
  emirateFactor: { DUBAI: 1.1, ABU_DHABI: 1.05 },
  inMarketAudiencePremium: 0.1,
  languagePremium: { ar: 0.05 },
  usageRightsPerMonth: 0.1,
  exclusivityPerMonth: 0.08,
  minimumPrice: 150,
  spread: 0.25,
};

export interface PricingInput {
  serviceKey: string;
  platform: PlatformKey;
  followers?: number | null;
  avgViews?: number | null; // verified avg views relevant to the platform
  engagementRate?: number | null;
  grade?: GradeLetter | null;
  categorySlug?: string | null;
  emirate?: string | null;
  audienceInMarketShare?: number | null;
  languages?: string[];
  complexityFactor?: number; // from service catalog
  usageRightsMonths?: number;
  exclusivityMonths?: number;
}

export interface PricingFactor {
  key: string;
  multiplier: number;
}

export interface PricingSuggestion {
  suggested: number;
  low: number;
  high: number;
  currency: 'AED';
  basis: 'BENCHMARK' | 'FORMULA';
  benchmarkId?: string;
  isSampleData: boolean;
  factors: PricingFactor[];
  disclaimer: string;
}

const round = (n: number) => Math.max(0, Math.round(n / 50) * 50);

export function matchBenchmark(rows: BenchmarkRow[], input: PricingInput): BenchmarkRow | null {
  const followers = input.followers ?? 0;
  const candidates = rows
    .filter((r) => r.platform === input.platform)
    .filter((r) => !r.serviceKey || r.serviceKey === input.serviceKey)
    .filter((r) => (r.followersMin == null || followers >= r.followersMin) && (r.followersMax == null || followers <= r.followersMax))
    .filter((r) => !r.categorySlug || r.categorySlug === input.categorySlug)
    .filter((r) => !r.emirate || r.emirate === input.emirate)
    .filter((r) => !r.grade || r.grade === input.grade);
  if (!candidates.length) return null;
  // Most specific wins
  const specificity = (r: BenchmarkRow) =>
    (r.serviceKey ? 8 : 0) + (r.categorySlug ? 4 : 0) + (r.grade ? 2 : 0) + (r.emirate ? 1 : 0) + (r.isSample ? 0 : 16);
  return candidates.sort((a, b) => specificity(b) - specificity(a))[0];
}

export function suggestPrice(input: PricingInput, benchmarks: BenchmarkRow[] = [], cfg: PricingConfig = DEFAULT_PRICING_CONFIG): PricingSuggestion {
  const factors: PricingFactor[] = [];
  const mult = (key: string, m: number) => {
    if (m !== 1) factors.push({ key, multiplier: Math.round(m * 1000) / 1000 });
    return m;
  };
  const disclaimer =
    'Advisory estimate only. Not an official UAE price list. The creator sets the actual price.';

  const bench = matchBenchmark(benchmarks, input);
  let base: number;
  let basis: PricingSuggestion['basis'];
  if (bench) {
    basis = 'BENCHMARK';
    base = bench.medianRate;
  } else {
    basis = 'FORMULA';
    const viewMult = cfg.serviceViewMultiplier[input.serviceKey];
    const cpm = cfg.cpmByPlatform[input.platform] ?? 0;
    if (input.avgViews && viewMult && cpm) {
      base = (input.avgViews / 1000) * cpm * viewMult;
      factors.push({ key: 'cpm_views', multiplier: 1 });
      // never below a sane fraction of the flat base fee
      base = Math.max(base, (cfg.baseFeeByService[input.serviceKey] ?? cfg.minimumPrice) * 0.3);
    } else {
      base = cfg.baseFeeByService[input.serviceKey] ?? 1000;
      if (input.followers) base *= mult('followers_scale', Math.min(4, Math.max(0.4, Math.log10(Math.max(input.followers, 1000)) - 3.6)));
    }
  }

  let m = 1;
  if (!bench || !bench.grade) m *= mult('grade', cfg.gradeFactor[input.grade ?? 'NOT_RATED'] ?? 1);
  if (!bench || !bench.categorySlug) m *= mult('category', (input.categorySlug && cfg.categoryFactor[input.categorySlug]) || 1);
  if (!bench || !bench.emirate) m *= mult('emirate', (input.emirate && cfg.emirateFactor[input.emirate]) || 1);
  if (input.audienceInMarketShare != null && input.audienceInMarketShare >= 0.5) m *= mult('in_market_audience', 1 + cfg.inMarketAudiencePremium);
  if (input.engagementRate != null) {
    const e = input.engagementRate;
    m *= mult('engagement', e >= 6 ? 1.1 : e >= 3 ? 1.0 : e >= 1.5 ? 0.92 : 0.85);
  }
  const lang = (input.languages ?? []).reduce((acc, l) => acc + (cfg.languagePremium[l] ?? 0), 0);
  if (lang) m *= mult('language', 1 + lang);
  if (input.complexityFactor && input.complexityFactor !== 1) m *= mult('production_complexity', input.complexityFactor);
  if (input.usageRightsMonths) m *= mult('usage_rights', 1 + cfg.usageRightsPerMonth * input.usageRightsMonths);
  if (input.exclusivityMonths) m *= mult('exclusivity', 1 + cfg.exclusivityPerMonth * input.exclusivityMonths);

  const suggested = Math.max(cfg.minimumPrice, round(base * m));
  let low: number, high: number;
  if (bench) {
    const ratio = suggested / Math.max(1, bench.medianRate);
    low = Math.max(cfg.minimumPrice, round(bench.minRate * ratio));
    high = round(bench.maxRate * ratio);
  } else {
    low = Math.max(cfg.minimumPrice, round(suggested * (1 - cfg.spread)));
    high = round(suggested * (1 + cfg.spread));
  }
  return {
    suggested,
    low,
    high,
    currency: 'AED',
    basis,
    benchmarkId: bench?.id,
    // Formula defaults are also sample assumptions until research is recorded.
    isSampleData: bench ? bench.isSample : true,
    factors,
    disclaimer,
  };
}

/** Effective price shown to a buyer for a creator service (promo applies until it ends). */
export function effectivePrice(price: number, promoPrice?: number | null, promoEndsAt?: Date | string | null, now = new Date()): number {
  if (promoPrice != null && promoPrice < price && (!promoEndsAt || new Date(promoEndsAt) > now)) return promoPrice;
  return price;
}
