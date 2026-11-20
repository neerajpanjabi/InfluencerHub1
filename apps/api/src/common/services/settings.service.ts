import { Injectable } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import {
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_CONTACT_SETTINGS,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_VAT_CONFIG,
  type CommissionConfig,
  type ContactSettings,
  type PricingConfig,
  type VatConfig,
} from '@influencehub/shared';
import { PrismaService } from './prisma.service';

export interface PlatformGeneralSettings {
  legalName: string;
  trn: string | null;
  address: string;
  supportEmail: string;
  autoCompleteDaysAfterPublish: number;
  payoutHoldDays: number;
  maintenanceMode: boolean;
  requireBusinessApproval: boolean;
  enabledCountries: string[];
}

const DEFAULTS: Record<string, unknown> = {
  contact: DEFAULT_CONTACT_SETTINGS,
  commission: DEFAULT_COMMISSION_CONFIG,
  vat: DEFAULT_VAT_CONFIG,
  pricing: DEFAULT_PRICING_CONFIG,
  platform: { legalName: 'InfluenceHub', trn: null, address: 'Dubai, UAE', supportEmail: 'support@influencehub.example', autoCompleteDaysAfterPublish: 7, payoutHoldDays: 7, maintenanceMode: false, requireBusinessApproval: false, enabledCountries: ['AE'] },
  ai: { provider: 'rules', maxResults: 20, explain: true, minScore: 0 },
  messaging: { maxMessagesPerMinute: 20, blockContactDetailsBeforeBooking: true, bannedTerms: [] },
};

/** Platform settings with a short in-process cache (settings change rarely; writes invalidate). */
@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: unknown; at: number }>();
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.value as T;
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    const merged = { ...(DEFAULTS[key] as object), ...((row?.value as object) ?? {}) };
    this.cache.set(key, { value: merged, at: Date.now() });
    return merged as T;
  }

  async set(key: string, value: unknown, actorId?: string) {
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedById: actorId },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: actorId },
    });
    this.cache.delete(key);
  }

  contact = () => this.get<ContactSettings>('contact');
  commission = () => this.get<CommissionConfig>('commission');
  vat = () => this.get<VatConfig>('vat');
  pricing = () => this.get<PricingConfig>('pricing');
  platform = () => this.get<PlatformGeneralSettings>('platform');
}
