import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { suggestPrice, type BenchmarkRow, type PlatformKey } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { InfluencersService } from '../influencers/influencers.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService, private readonly settings: SettingsService, private readonly influencers: InfluencersService) {}

  catalog() {
    return this.prisma.serviceCatalog.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  private async profileFor(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({ where: { userId }, include: { categories: { include: { category: { include: { parent: true } } } } } });
    if (!p) throw new NotFoundException();
    return p;
  }

  async benchmarks(): Promise<BenchmarkRow[]> {
    const rows = await this.prisma.pricingBenchmark.findMany({ include: { catalog: { select: { key: true } }, category: { select: { slug: true } } } });
    return rows.map((r) => ({
      id: r.id,
      platform: r.platform as PlatformKey,
      serviceKey: r.catalog?.key ?? null,
      categorySlug: r.category?.slug ?? null,
      emirate: r.emirate,
      grade: r.grade as any,
      followersMin: r.followersMin,
      followersMax: r.followersMax,
      minRate: Number(r.minRate),
      medianRate: Number(r.medianRate),
      maxRate: Number(r.maxRate),
      isSample: r.isSample,
      researchSource: r.researchSource,
    }));
  }

  /** Advisory price suggestion for a creator + service, from their own verified metrics. */
  async suggestionFor(userId: string, catalogKey: string, opts: { usageRightsMonths?: number; exclusivityMonths?: number } = {}) {
    const p = await this.profileFor(userId);
    const cat = await this.prisma.serviceCatalog.findUnique({ where: { key: catalogKey } });
    if (!cat) throw new NotFoundException({ code: 'UNKNOWN_SERVICE' });
    const primary = p.categories.find((c) => c.isPrimary) ?? p.categories[0];
    const aud = await this.prisma.audienceInsight.findFirst({ where: { socialAccount: { influencerId: p.id }, dimension: 'COUNTRY', key: 'AE' }, orderBy: { collectedAt: 'desc' } });
    const platform = cat.platform as PlatformKey;
    const avgViews = platform === 'TIKTOK' ? p.avgVideoViews : platform === 'INSTAGRAM' ? p.avgReelViews : p.avgReelViews ?? p.avgVideoViews;
    return suggestPrice(
      {
        serviceKey: cat.key,
        platform,
        followers: p.totalFollowers,
        avgViews,
        engagementRate: p.engagementRate ? Number(p.engagementRate) : null,
        grade: p.currentGrade as any,
        categorySlug: primary ? (primary.category.parent?.slug ?? primary.category.slug) : null,
        emirate: p.emirate,
        audienceInMarketShare: aud ? Number(aud.value) : null,
        languages: p.languages,
        complexityFactor: Number(cat.complexityFactor),
        ...opts,
      },
      await this.benchmarks(),
      await this.settings.pricing(),
    );
  }

  async myServices(userId: string) {
    const p = await this.profileFor(userId);
    return this.prisma.influencerService.findMany({ where: { influencerId: p.id, deletedAt: null }, include: { catalog: true, pricingHistory: { orderBy: { changedAt: 'desc' }, take: 5 } }, orderBy: { createdAt: 'asc' } });
  }

  async upsert(userId: string, dto: any, serviceId?: string) {
    const p = await this.profileFor(userId);
    const cat = await this.prisma.serviceCatalog.findUnique({ where: { key: dto.catalogKey } });
    if (!cat || !cat.isActive) throw new BadRequestException({ code: 'UNKNOWN_SERVICE' });
    const suggestion = await this.suggestionFor(userId, cat.key, { usageRightsMonths: dto.usageRightsDays ? Math.ceil(dto.usageRightsDays / 30) : 0, exclusivityMonths: dto.exclusivityDays ? Math.ceil(dto.exclusivityDays / 30) : 0 });
    const data = {
      catalogId: cat.id,
      title: dto.title,
      titleAr: dto.titleAr,
      description: dto.description,
      descriptionAr: dto.descriptionAr,
      platform: cat.platform,
      deliverables: cat.defaultDeliverables as Prisma.InputJsonValue,
      price: dto.price,
      promoPrice: dto.promoPrice ?? null,
      promoEndsAt: dto.promoEndsAt ? new Date(dto.promoEndsAt) : null,
      minimumPrice: dto.minimumPrice ?? null,
      suggestedPrice: suggestion.suggested,
      deliveryDays: dto.deliveryDays,
      revisions: dto.revisions,
      usageRights: dto.usageRights,
      usageRightsDays: dto.usageRightsDays,
      exclusivityDays: dto.exclusivityDays,
      addOns: dto.addOns ?? [],
      taxTreatment: dto.taxTreatment,
      status: dto.status,
    };
    let svc;
    if (serviceId) {
      const existing = await this.prisma.influencerService.findFirst({ where: { id: serviceId, influencerId: p.id, deletedAt: null } });
      if (!existing) throw new NotFoundException();
      svc = await this.prisma.influencerService.update({ where: { id: existing.id }, data });
      if (Number(existing.price) !== Number(dto.price)) {
        await this.prisma.pricingHistory.create({ data: { serviceId: existing.id, oldPrice: existing.price, newPrice: dto.price, suggested: suggestion.suggested, changedById: userId } });
      }
    } else {
      svc = await this.prisma.influencerService.create({ data: { ...data, influencerId: p.id } });
      await this.prisma.pricingHistory.create({ data: { serviceId: svc.id, newPrice: dto.price, suggested: suggestion.suggested, changedById: userId } });
    }
    await this.influencers.refreshSearchText(p.id);
    return { service: svc, suggestion };
  }

  async archive(userId: string, serviceId: string) {
    const p = await this.profileFor(userId);
    const r = await this.prisma.influencerService.updateMany({ where: { id: serviceId, influencerId: p.id, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
    if (!r.count) throw new NotFoundException();
    await this.influencers.refreshSearchText(p.id);
    return { ok: true };
  }

  async myPackages(userId: string) {
    const p = await this.profileFor(userId);
    return this.prisma.servicePackage.findMany({ where: { influencerId: p.id, status: { not: 'ARCHIVED' } }, include: { items: { include: { service: true } } } });
  }

  async createPackage(userId: string, dto: { title: string; titleAr?: string; description?: string; price: number; deliveryDays: number; items: Array<{ serviceId: string; quantity: number }> }) {
    const p = await this.profileFor(userId);
    const services = await this.prisma.influencerService.findMany({ where: { id: { in: dto.items.map((i) => i.serviceId) }, influencerId: p.id, deletedAt: null } });
    if (services.length !== new Set(dto.items.map((i) => i.serviceId)).size) throw new BadRequestException({ code: 'INVALID_PACKAGE_SERVICES' });
    return this.prisma.servicePackage.create({
      data: { influencerId: p.id, title: dto.title, titleAr: dto.titleAr, description: dto.description, price: dto.price, deliveryDays: dto.deliveryDays, items: { create: dto.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })) } },
      include: { items: true },
    });
  }

  async archivePackage(userId: string, id: string) {
    const p = await this.profileFor(userId);
    const r = await this.prisma.servicePackage.updateMany({ where: { id, influencerId: p.id }, data: { status: 'ARCHIVED' } });
    if (!r.count) throw new NotFoundException();
    return { ok: true };
  }
}
