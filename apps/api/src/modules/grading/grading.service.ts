import { Injectable, NotFoundException } from '@nestjs/common';
import { MetricVerification as DbMetricVerification, Prisma } from '@influencehub/database';
import { computeGrade, mergeGradingConfig, type GradingConfig, type GradingInput, type MetricInput, type PlatformMetrics } from '@influencehub/shared';
import { sandboxAllowed } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  async activeRule() {
    const rule = await this.prisma.gradingRule.findUniqueOrThrow({ where: { key: 'default' } });
    const version = rule.activeVersionId
      ? await this.prisma.gradingRuleVersion.findUniqueOrThrow({ where: { id: rule.activeVersionId } })
      : await this.prisma.gradingRuleVersion.findFirstOrThrow({ where: { ruleId: rule.id }, orderBy: { version: 'desc' } });
    return { rule, version, config: mergeGradingConfig(version.config as Partial<GradingConfig>) };
  }

  /** Builds grading input from the latest snapshot per metric for each usable social account. */
  async buildInput(influencerId: string): Promise<GradingInput> {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      include: {
        categories: { include: { category: { include: { parent: true } } } },
        socialAccounts: { where: { status: { in: ['CONNECTED', 'TOKEN_EXPIRED'] } } },
      },
    });
    if (!profile) throw new NotFoundException();
    const primary = profile.categories.find((c) => c.isPrimary) ?? profile.categories[0];
    const primarySlug = primary ? (primary.category.parent?.slug ?? primary.category.slug) : null;
    const input: GradingInput = { primaryCategorySlug: primarySlug };
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    let audienceShare: MetricInput | undefined;

    for (const acc of profile.socialAccounts) {
      if (acc.isSandbox && !sandboxAllowed()) continue;
      if (acc.platform !== 'INSTAGRAM' && acc.platform !== 'TIKTOK') continue;
      const latest = await this.prisma.$queryRaw<Array<{ metricType: string; value: Prisma.Decimal; verificationStatus: DbMetricVerification; collectedAt: Date; sampleSize: number | null; source: string }>>`
        SELECT DISTINCT ON ("metricType") "metricType", value, "verificationStatus", "collectedAt", "sampleSize", source
        FROM social_metric_snapshots WHERE "socialAccountId" = ${acc.id}::uuid
        ORDER BY "metricType", "collectedAt" DESC`;
      const m = (type: string): MetricInput | undefined => {
        const row = latest.find((r) => r.metricType === type);
        if (!row) return undefined;
        let verification = row.verificationStatus as MetricInput['verification'];
        if (row.source === 'SANDBOX' && !sandboxAllowed()) verification = 'UNAVAILABLE';
        if (acc.status === 'TOKEN_EXPIRED' && verification === 'API_VERIFIED') verification = 'EXPIRED';
        return { value: Number(row.value), verification, collectedAt: row.collectedAt, sampleSize: row.sampleSize };
      };
      const posts = await this.prisma.socialMediaPost.findMany({ where: { socialAccountId: acc.id, mediaType: { not: 'STORY' }, publishedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, select: { publishedAt: true, views: true } });
      const recent = posts.filter((p) => p.publishedAt && p.publishedAt >= since30).length;
      const viewVals = posts.map((p) => p.views).filter((v): v is number => v != null);
      const mean = viewVals.length ? viewVals.reduce((a, b) => a + b, 0) / viewVals.length : 0;
      const cv = viewVals.length > 2 && mean > 0 ? Math.sqrt(viewVals.reduce((a, v) => a + (v - mean) ** 2, 0) / viewVals.length) / mean : undefined;
      const pm: PlatformMetrics = {
        followers: m('FOLLOWERS'),
        engagementRate: m('ENGAGEMENT_RATE'),
        postsLast30Days: posts.length ? recent : undefined,
        viewsCoefficientOfVariation: cv,
      };
      if (acc.platform === 'INSTAGRAM') {
        pm.avgReelViews = m('AVG_REEL_VIEWS');
        pm.avgStoryViews = m('AVG_STORY_VIEWS');
        input.instagram = pickStronger(input.instagram, pm);
      } else {
        pm.avgVideoViews = m('AVG_VIDEO_VIEWS');
        input.tiktok = pickStronger(input.tiktok, pm);
      }
      const aud = await this.prisma.audienceInsight.findFirst({ where: { socialAccountId: acc.id, dimension: 'COUNTRY', key: 'AE' }, orderBy: { collectedAt: 'desc' } });
      if (aud && (!acc.isSandbox || sandboxAllowed())) {
        const cand: MetricInput = { value: Number(aud.value), verification: aud.verificationStatus as MetricInput['verification'], collectedAt: aud.collectedAt };
        if (!audienceShare || cand.value > audienceShare.value) audienceShare = cand;
      }
    }
    input.audienceTargetMarketShare = audienceShare;
    return input;
  }

  /** Recompute, persist score + history, and refresh denormalised search fields. */
  async recompute(influencerId: string) {
    const { version, config } = await this.activeRule();
    const input = await this.buildInput(influencerId);
    const result = computeGrade(input, config);
    const ig = input.instagram;
    const tt = input.tiktok;
    await this.prisma.$transaction(async (tx) => {
      await tx.influencerScore.updateMany({ where: { influencerId, isCurrent: true }, data: { isCurrent: false } });
      await tx.influencerScore.create({ data: { influencerId, ruleVersionId: version.id, score: result.score, grade: result.grade, breakdown: result as any, dataCoverage: result.coverage } });
      await tx.influencerScoreHistory.create({ data: { influencerId, score: result.score, grade: result.grade, ruleVersion: version.version, breakdown: result as any } });
      await tx.influencerProfile.update({
        where: { id: influencerId },
        data: {
          currentScore: result.score,
          currentGrade: result.grade,
          totalFollowers: Math.round((ig?.followers?.value ?? 0) + (tt?.followers?.value ?? 0)),
          avgReelViews: ig?.avgReelViews ? Math.round(ig.avgReelViews.value) : null,
          avgStoryViews: ig?.avgStoryViews ? Math.round(ig.avgStoryViews.value) : null,
          avgVideoViews: tt?.avgVideoViews ? Math.round(tt.avgVideoViews.value) : null,
          engagementRate: ig?.engagementRate?.value ?? tt?.engagementRate?.value ?? null,
        },
      });
    });
    return result;
  }

  async current(influencerId: string) {
    return this.prisma.influencerScore.findFirst({ where: { influencerId, isCurrent: true }, include: { ruleVersion: { select: { version: true } } } });
  }

  history(influencerId: string) {
    return this.prisma.influencerScoreHistory.findMany({ where: { influencerId }, orderBy: { recordedAt: 'asc' }, take: 52 });
  }
}

function pickStronger(a: PlatformMetrics | undefined, b: PlatformMetrics): PlatformMetrics {
  if (!a) return b;
  return (b.followers?.value ?? 0) > (a.followers?.value ?? 0) ? b : a;
}
