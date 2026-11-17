import { Injectable } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { normalizeText, type InfluencerSearchParams } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { sandboxAllowed } from '../../config/env';

export const PUBLIC_CARD_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  displayNameAr: true,
  profileImageUrl: true,
  emirate: true,
  city: true,
  languages: true,
  currentGrade: true,
  currentScore: true,
  totalFollowers: true,
  avgReelViews: true,
  avgStoryViews: true,
  avgVideoViews: true,
  engagementRate: true,
  startingPrice: true,
  ratingAverage: true,
  ratingCount: true,
  identityStatus: true,
  medicalStatus: true,
  isMedicalProfessional: true,
  isFeatured: true,
  acceptingBookings: true,
  visibility: true,
  createdAt: true,
  categories: { select: { isPrimary: true, category: { select: { slug: true, nameEn: true, nameAr: true, parentId: true } } } },
  socialAccounts: { where: { status: 'CONNECTED' as const }, select: { platform: true, username: true, isSandbox: true, lastSyncedAt: true } },
} satisfies Prisma.InfluencerProfileSelect;

export type PublicCard = Prisma.InfluencerProfileGetPayload<{ select: typeof PUBLIC_CARD_SELECT }>;

/** Apply the creator's privacy toggles to a public card. */
export function applyVisibility<T extends Partial<PublicCard>>(card: T): T {
  const v = (card.visibility ?? {}) as Record<string, boolean>;
  const out: any = { ...card };
  if (v.showCity === false) out.city = null;
  if (v.showStoryViews === false) out.avgStoryViews = null;
  if (v.showLanguages === false) out.languages = [];
  out.hasSandboxData = (card.socialAccounts ?? []).some((s: any) => s.isSandbox);
  delete out.visibility;
  return out;
}

@Injectable()
export class InfluencerSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds a fully parameterised Prisma filter — no string-concatenated SQL. */
  async buildWhere(p: Partial<InfluencerSearchParams>): Promise<Prisma.InfluencerProfileWhereInput> {
    const AND: Prisma.InfluencerProfileWhereInput[] = [{ isPublic: true, deletedAt: null, user: { status: 'ACTIVE' } }];
    if (!sandboxAllowed()) AND.push({ socialAccounts: { none: { isSandbox: true } } });
    if (p.q) {
      const terms = normalizeText(p.q).split(' ').filter((t) => t.length > 1).slice(0, 6);
      for (const t of terms) {
        AND.push({
          OR: [
            { searchText: { contains: t, mode: 'insensitive' } },
            { displayName: { contains: t, mode: 'insensitive' } },
            { displayNameAr: { contains: t } },
            { socialAccounts: { some: { username: { contains: t, mode: 'insensitive' } } } },
          ],
        });
      }
    }
    if (p.category?.length) {
      const cats = await this.prisma.category.findMany({ where: { slug: { in: p.category } }, select: { id: true, children: { select: { id: true } } } });
      const ids = cats.flatMap((c) => [c.id, ...c.children.map((ch) => ch.id)]);
      AND.push({ categories: { some: { categoryId: { in: ids } } } });
    }
    if (p.platform?.length) {
      const social = p.platform.filter((x) => x === 'INSTAGRAM' || x === 'TIKTOK');
      if (social.length) AND.push({ socialAccounts: { some: { platform: { in: social as any }, status: 'CONNECTED' } } });
    }
    if (p.emirate?.length) AND.push({ emirate: { in: p.emirate } });
    if (p.city) AND.push({ city: { equals: p.city, mode: 'insensitive' } });
    if (p.language?.length) AND.push({ languages: { hasSome: p.language } });
    if (p.audienceLocation?.length) AND.push({ audienceLocations: { hasSome: p.audienceLocation } });
    if (p.gender) AND.push({ gender: p.gender });
    if (p.grade?.length) AND.push({ currentGrade: { in: p.grade } });
    if (p.minFollowers != null) AND.push({ totalFollowers: { gte: Math.floor(p.minFollowers) } });
    if (p.maxFollowers != null) AND.push({ totalFollowers: { lte: Math.floor(p.maxFollowers) } });
    if (p.minReelViews != null) AND.push({ avgReelViews: { gte: Math.floor(p.minReelViews) } });
    if (p.minStoryViews != null) AND.push({ avgStoryViews: { gte: Math.floor(p.minStoryViews) } });
    if (p.minVideoViews != null) AND.push({ avgVideoViews: { gte: Math.floor(p.minVideoViews) } });
    if (p.minEngagement != null) AND.push({ engagementRate: { gte: p.minEngagement } });
    if (p.minPrice != null || p.maxPrice != null) {
      AND.push({ services: { some: { status: 'ACTIVE', deletedAt: null, price: { ...(p.minPrice != null ? { gte: p.minPrice } : {}), ...(p.maxPrice != null ? { lte: p.maxPrice } : {}) } } } });
    }
    if (p.serviceType?.length) AND.push({ services: { some: { status: 'ACTIVE', deletedAt: null, catalog: { key: { in: p.serviceType } } } } });
    if (p.verifiedOnly) AND.push({ identityStatus: 'VERIFIED' });
    if (p.medicalVerifiedOnly) AND.push({ isMedicalProfessional: true, medicalStatus: 'VERIFIED' });
    if (p.availableOnly) {
      const today = new Date();
      AND.push({ acceptingBookings: true, availability: { none: { isAvailable: false, startsOn: { lte: today }, endsOn: { gte: today } } } });
    }
    return { AND };
  }

  orderBy(sort: InfluencerSearchParams['sort']): Prisma.InfluencerProfileOrderByWithRelationInput[] {
    switch (sort) {
      case 'grade':
        return [{ currentScore: { sort: 'desc', nulls: 'last' } }];
      case 'followers':
        return [{ totalFollowers: 'desc' }];
      case 'views':
        return [{ avgReelViews: { sort: 'desc', nulls: 'last' } }, { avgVideoViews: { sort: 'desc', nulls: 'last' } }];
      case 'engagement':
        return [{ engagementRate: { sort: 'desc', nulls: 'last' } }];
      case 'price_asc':
        return [{ startingPrice: { sort: 'asc', nulls: 'last' } }];
      case 'price_desc':
        return [{ startingPrice: { sort: 'desc', nulls: 'last' } }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        // relevance: featured, then verified grade score, then followers
        return [{ isFeatured: 'desc' }, { currentScore: { sort: 'desc', nulls: 'last' } }, { totalFollowers: 'desc' }];
    }
  }

  async search(p: InfluencerSearchParams) {
    const where = await this.buildWhere(p);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.influencerProfile.count({ where }),
      this.prisma.influencerProfile.findMany({ where, select: PUBLIC_CARD_SELECT, orderBy: [...this.orderBy(p.sort), { id: 'asc' }], skip: (p.page - 1) * p.pageSize, take: p.pageSize }),
    ]);
    return { items: items.map(applyVisibility), total, page: p.page, pageSize: p.pageSize, pages: Math.ceil(total / p.pageSize) };
  }
}
