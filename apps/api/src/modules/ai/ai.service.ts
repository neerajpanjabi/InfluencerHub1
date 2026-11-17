import { Injectable } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { parseQuery, toSearchQuery, type InfluencerSearchParams, type ParsedQuery } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { InfluencerSearchService, PUBLIC_CARD_SELECT, applyVisibility } from '../influencers/search.service';
import { AnthropicQueryProvider, QueryUnderstandingProvider } from './llm.provider';

const GRADE_POINTS: Record<string, number> = { S: 30, A: 25, B: 18, C: 10, D: 4, NOT_RATED: 6 };

export interface Reason {
  code: string;
  params?: Record<string, string | number>;
}

/**
 * AI discovery: NL query → structured filters (LLM when configured, deterministic otherwise)
 * → real database retrieval → eligibility → explainable ranking. Never fabricates data.
 */
@Injectable()
export class AiService {
  private providers: QueryUnderstandingProvider[] = [new AnthropicQueryProvider()];
  constructor(private readonly prisma: PrismaService, private readonly search: InfluencerSearchService, private readonly settings: SettingsService) {}

  async understand(query: string, previous?: Partial<ParsedQuery>): Promise<{ parsed: ParsedQuery; parser: string }> {
    const rules = parseQuery(query);
    const base: ParsedQuery = previous ? mergeParsed(previous as ParsedQuery, rules) : rules;
    for (const p of this.providers) {
      if (!p.isConfigured()) continue;
      const llm = await p.parse(query, previous);
      if (llm) return { parsed: { ...base, ...stripEmpty(llm), detectedLocale: rules.detectedLocale, understood: base.understood }, parser: `LLM:${p.name}` };
    }
    return { parsed: base, parser: 'RULES' };
  }

  toSearchParams(p: ParsedQuery): Partial<InfluencerSearchParams> {
    return {
      category: p.categories.length ? p.categories : undefined,
      emirate: p.emirates.length ? p.emirates : undefined,
      platform: p.platforms.length ? p.platforms : undefined,
      language: p.languages.length ? p.languages : undefined,
      gender: p.gender,
      minFollowers: p.minFollowers,
      maxFollowers: p.maxFollowers,
      maxPrice: p.maxBudget,
      grade: p.minGrade ? (['S', 'A', 'B', 'C'].slice(0, ['S', 'A', 'B', 'C'].indexOf(p.minGrade) + 1) as any) : undefined,
      verifiedOnly: p.verifiedOnly,
    };
  }

  async recommend(opts: { query: string; userId?: string; businessUserId?: string; previous?: Partial<ParsedQuery>; locale: 'en' | 'ar' }) {
    const started = Date.now();
    const cfg = await this.settings.get<{ maxResults: number }>('ai');
    const { parsed, parser } = await this.understand(opts.query, opts.previous);
    const limit = Math.min(parsed.limit ?? cfg.maxResults ?? 20, 50);
    const params = this.toSearchParams(parsed);

    let { candidates, relaxed } = await this.retrieve(params, parsed);
    const ranked = candidates.map((c) => this.score(c, parsed)).sort((a, b) => b.score - a.score).slice(0, limit);

    const business = opts.businessUserId ? await this.prisma.businessProfile.findUnique({ where: { userId: opts.businessUserId }, select: { id: true } }) : null;
    const log = await this.prisma.aiSearchLog.create({
      data: {
        userId: opts.userId,
        query: opts.query.slice(0, 1000),
        locale: opts.locale,
        parser,
        parsedFilters: { ...parsed, relaxed } as unknown as Prisma.InputJsonValue,
        resultCount: ranked.length,
        latencyMs: Date.now() - started,
        recommendations: {
          create: ranked.map((r, i) => ({ influencerId: r.card.id, businessId: business?.id, rank: i + 1, score: r.score, reasons: r.reasons as unknown as Prisma.InputJsonValue })),
        },
      },
      include: { recommendations: { select: { id: true, influencerId: true } } },
    });
    const recIds = new Map(log.recommendations.map((r) => [r.influencerId, r.id]));
    return {
      searchId: log.id,
      parser,
      understood: parsed,
      relaxed,
      browseQuery: toSearchQuery(params),
      results: ranked.map((r, i) => ({ rank: i + 1, recommendationId: recIds.get(r.card.id), score: Math.round(r.score * 10) / 10, reasons: r.reasons, influencer: r.card })),
      suggestions: ranked.length ? [] : this.suggestAlternatives(parsed),
    };
  }

  /** Strict retrieval first; if nothing matches, progressively relax the least essential constraints. */
  private async retrieve(params: Partial<InfluencerSearchParams>, parsed: ParsedQuery) {
    const relaxOrder: Array<keyof InfluencerSearchParams> = ['grade', 'gender', 'language', 'maxPrice', 'minFollowers', 'emirate', 'platform'];
    const relaxed: string[] = [];
    let current = { ...params };
    for (let i = 0; i <= relaxOrder.length; i++) {
      const where = await this.search.buildWhere(current);
      const rows = await this.prisma.influencerProfile.findMany({
        where,
        select: { ...PUBLIC_CARD_SELECT, bio: true, gender: true, services: { where: { status: 'ACTIVE', deletedAt: null }, select: { price: true, catalog: { select: { key: true } } } } },
        take: 200,
      });
      if (rows.length || i === relaxOrder.length) return { candidates: rows, relaxed };
      // Never relax the core intent (category) — that would return irrelevant creators.
      const key = relaxOrder[i];
      if (current[key] != null) {
        relaxed.push(key);
        current = { ...current, [key]: undefined };
      }
    }
    void parsed;
    return { candidates: [], relaxed };
  }

  private score(c: any, p: ParsedQuery): { card: any; score: number; reasons: Reason[] } {
    const reasons: Reason[] = [];
    let s = 0;
    const slugs: string[] = c.categories.map((x: any) => x.category.slug);
    const specialityHits = p.specialities.filter((sp) => slugs.includes(sp));
    if (specialityHits.length) {
      s += 30;
      reasons.push({ code: 'SPECIALITY_MATCH', params: { value: specialityHits.join(', ') } });
    } else if (p.categories.some((cat) => slugs.includes(cat) || c.categories.some((x: any) => x.category.parentId && slugs.includes(cat)))) {
      s += 20;
      reasons.push({ code: 'CATEGORY_MATCH', params: { value: p.categories.join(', ') } });
    }
    if (p.emirates.length && c.emirate && p.emirates.includes(c.emirate)) {
      s += 10;
      reasons.push({ code: 'LOCATION_MATCH', params: { value: c.emirate } });
    }
    const langHits = p.languages.filter((l) => c.languages.includes(l));
    if (langHits.length) {
      s += 10;
      reasons.push({ code: 'LANGUAGE_MATCH', params: { value: langHits.join(', ') } });
    }
    const platforms = new Set(c.socialAccounts.map((a: any) => a.platform));
    if (p.platforms.length && p.platforms.every((pl) => platforms.has(pl))) {
      s += 8;
      reasons.push({ code: 'PLATFORM_MATCH', params: { value: p.platforms.join(', ') } });
    }
    if (p.minFollowers && c.totalFollowers >= p.minFollowers) reasons.push({ code: 'FOLLOWERS_MEET', params: { value: c.totalFollowers, min: p.minFollowers } });
    const relevantPrices: number[] = c.services.filter((sv: any) => !p.serviceTypes.length || p.serviceTypes.includes(sv.catalog.key)).map((sv: any) => Number(sv.price));
    const minPrice = relevantPrices.length ? Math.min(...relevantPrices) : c.startingPrice ? Number(c.startingPrice) : null;
    if (p.serviceTypes.length && relevantPrices.length) {
      s += 6;
      reasons.push({ code: 'OFFERS_SERVICE', params: { value: p.serviceTypes.join(', '), price: minPrice ?? 0 } });
    }
    if (p.maxBudget && minPrice != null && minPrice <= p.maxBudget) {
      s += 8;
      reasons.push({ code: 'WITHIN_BUDGET', params: { price: minPrice, budget: p.maxBudget } });
    }
    if (p.budgetTier === 'affordable' && minPrice != null) {
      const bonus = Math.max(0, 10 - minPrice / 300);
      s += bonus;
      if (bonus > 3) reasons.push({ code: 'AFFORDABLE', params: { price: minPrice } });
    }
    s += GRADE_POINTS[c.currentGrade] ?? 0;
    if (c.currentGrade !== 'NOT_RATED') reasons.push({ code: 'PERFORMANCE_GRADE', params: { grade: c.currentGrade, score: Number(c.currentScore ?? 0) } });
    if (c.engagementRate && Number(c.engagementRate) >= 3) {
      s += 4;
      reasons.push({ code: 'HIGH_ENGAGEMENT', params: { value: Number(c.engagementRate) } });
    }
    if (c.identityStatus === 'VERIFIED') {
      s += 4;
      reasons.push({ code: 'IDENTITY_VERIFIED' });
    }
    if (c.isMedicalProfessional && c.medicalStatus === 'VERIFIED' && p.categories.some((x) => x === 'medical-healthcare' || p.specialities.length)) {
      s += 6;
      reasons.push({ code: 'MEDICAL_CREDENTIAL_VERIFIED' });
    }
    if (c.ratingAverage) s += Number(c.ratingAverage);
    const kw = p.keywords.filter((k) => (c.bio ?? '').toLowerCase().includes(k));
    if (kw.length) {
      s += Math.min(6, kw.length * 2);
      reasons.push({ code: 'KEYWORD_MATCH', params: { value: kw.slice(0, 3).join(', ') } });
    }
    const { services, bio, gender, ...card } = c;
    void services;
    void bio;
    void gender;
    return { card: applyVisibility(card), score: s, reasons };
  }

  private suggestAlternatives(p: ParsedQuery) {
    const out: Array<{ code: string; params?: Record<string, string> }> = [];
    if (p.specialities.length) out.push({ code: 'TRY_PARENT_CATEGORY' });
    if (p.emirates.length) out.push({ code: 'TRY_ALL_EMIRATES' });
    if (p.minFollowers) out.push({ code: 'LOWER_FOLLOWER_MINIMUM' });
    if (p.maxBudget) out.push({ code: 'INCREASE_BUDGET' });
    out.push({ code: 'BROWSE_CATEGORY' });
    return out;
  }

  async feedback(userId: string, recommendationId: string, helpful: boolean, comment?: string) {
    return this.prisma.aiRecommendationFeedback.upsert({
      where: { recommendationId_userId: { recommendationId, userId } },
      update: { helpful, comment },
      create: { recommendationId, userId, helpful, comment },
    });
  }

  async quality() {
    const [searches, zero, feedback, byParser] = await Promise.all([
      this.prisma.aiSearchLog.count(),
      this.prisma.aiSearchLog.count({ where: { resultCount: 0 } }),
      this.prisma.aiRecommendationFeedback.groupBy({ by: ['helpful'], _count: true }),
      this.prisma.aiSearchLog.groupBy({ by: ['parser'], _count: true, _avg: { latencyMs: true, resultCount: true } }),
    ]);
    const helpful = feedback.find((f) => f.helpful)?._count ?? 0;
    const unhelpful = feedback.find((f) => !f.helpful)?._count ?? 0;
    return { searches, zeroResultRate: searches ? zero / searches : 0, helpfulRate: helpful + unhelpful ? helpful / (helpful + unhelpful) : null, feedbackCount: helpful + unhelpful, byParser };
  }
}

function stripEmpty(o: Partial<ParsedQuery>): Partial<ParsedQuery> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length))) as Partial<ParsedQuery>;
}

/** Conversational refinement: new message overrides only the dimensions it mentions. */
export function mergeParsed(prev: ParsedQuery, next: ParsedQuery): ParsedQuery {
  const pick = <T>(a: T[] = [], b: T[] = []) => (b.length ? b : a);
  return {
    categories: pick(prev.categories, next.categories),
    specialities: next.categories.length ? next.specialities : prev.specialities ?? [],
    emirates: pick(prev.emirates, next.emirates),
    platforms: pick(prev.platforms, next.platforms),
    languages: pick(prev.languages, next.languages),
    serviceTypes: pick(prev.serviceTypes, next.serviceTypes),
    gender: next.gender ?? prev.gender,
    minFollowers: next.minFollowers ?? (next.maxFollowers ? undefined : prev.minFollowers),
    maxFollowers: next.maxFollowers ?? prev.maxFollowers,
    minViews: next.minViews ?? prev.minViews,
    maxBudget: next.maxBudget ?? prev.maxBudget,
    budgetTier: next.budgetTier ?? prev.budgetTier,
    minGrade: next.minGrade ?? prev.minGrade,
    limit: next.limit ?? prev.limit,
    verifiedOnly: next.verifiedOnly ?? prev.verifiedOnly,
    keywords: next.keywords.length ? next.keywords : prev.keywords ?? [],
    detectedLocale: next.detectedLocale,
    understood: [...(prev.understood ?? []), ...next.understood],
  };
}
