/* eslint-disable no-console */
// Load packages/database/.env (SEED_* settings) when present; Node 21.7+.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env file — rely on the environment */
}
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import {
  ADMIN_ROLES,
  PERMISSIONS,
  CATEGORY_SEEDS,
  SERVICE_CATALOG_SEEDS,
  DEFAULT_GRADING_CONFIG,
  DEFAULT_CONTACT_SETTINGS,
  DEFAULT_COMMISSION_CONFIG,
  DEFAULT_VAT_CONFIG,
  DEFAULT_PRICING_CONFIG,
} from '@influencehub/shared';
import { seedDemoData } from './demo';

const prisma = new PrismaClient();

async function seedRbac() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const allRoles: Record<string, readonly string[]> = { ...ADMIN_ROLES, BUSINESS: [], INFLUENCER: [] };
  for (const [key, perms] of Object.entries(allRoles)) {
    const role = await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const p of perms) {
      const perm = await prisma.permission.findUniqueOrThrow({ where: { key: p } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
  }
  console.log(`✔ RBAC: ${PERMISSIONS.length} permissions, ${Object.keys(allRoles).length} roles`);
}

async function seedCategories() {
  let order = 0;
  for (const c of CATEGORY_SEEDS) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.en, nameAr: c.ar, icon: c.icon, requiresMedicalCompliance: !!c.medical },
      create: { slug: c.slug, nameEn: c.en, nameAr: c.ar, icon: c.icon, sortOrder: order++, requiresMedicalCompliance: !!c.medical },
    });
    let childOrder = 0;
    for (const ch of c.children ?? []) {
      await prisma.category.upsert({
        where: { slug: ch.slug },
        update: { nameEn: ch.en, nameAr: ch.ar, parentId: parent.id },
        create: { slug: ch.slug, nameEn: ch.en, nameAr: ch.ar, parentId: parent.id, sortOrder: childOrder++, requiresMedicalCompliance: !!c.medical },
      });
    }
  }
  console.log(`✔ Categories: ${await prisma.category.count()}`);
}

async function seedServiceCatalog() {
  let order = 0;
  for (const s of SERVICE_CATALOG_SEEDS) {
    await prisma.serviceCatalog.upsert({
      where: { key: s.key },
      update: { nameEn: s.en, nameAr: s.ar, platform: s.platform, defaultDeliverables: s.deliverables, complexityFactor: s.complexity },
      create: { key: s.key, nameEn: s.en, nameAr: s.ar, platform: s.platform, defaultDeliverables: s.deliverables, complexityFactor: s.complexity, sortOrder: order++ },
    });
  }
  console.log(`✔ Service catalogue: ${SERVICE_CATALOG_SEEDS.length}`);
}

async function seedSettings() {
  const settings: Array<[string, unknown, string]> = [
    ['contact', DEFAULT_CONTACT_SETTINGS, 'Paid contact configuration (fee is VAT exclusive, AED)'],
    ['commission', DEFAULT_COMMISSION_CONFIG, 'Booking commission configuration'],
    ['vat', DEFAULT_VAT_CONFIG, 'UAE VAT configuration — confirm with tax adviser before go-live'],
    ['pricing', DEFAULT_PRICING_CONFIG, 'Pricing recommendation engine parameters (SAMPLE defaults)'],
    ['platform', {
      legalName: 'InfluenceHub (legal entity TBC)',
      trn: null,
      address: 'Dubai, United Arab Emirates',
      supportEmail: 'support@influencehub.example',
      autoCompleteDaysAfterPublish: 7,
      payoutHoldDays: 7,
      maintenanceMode: false,
      requireBusinessApproval: false,
      enabledCountries: ['AE'],
    }, 'General platform settings'],
    ['ai', { provider: 'rules', maxResults: 20, explain: true, minScore: 0 }, 'AI discovery configuration'],
    ['messaging', { maxMessagesPerMinute: 20, blockContactDetailsBeforeBooking: true, bannedTerms: [] }, 'Messaging moderation'],
  ];
  for (const [key, value, description] of settings) {
    await prisma.platformSetting.upsert({ where: { key }, update: {}, create: { key, value: value as Prisma.InputJsonValue, description } });
  }

  const rule = await prisma.gradingRule.upsert({ where: { key: 'default' }, update: {}, create: { key: 'default', name: 'Default performance grading' } });
  const existing = await prisma.gradingRuleVersion.findFirst({ where: { ruleId: rule.id } });
  if (!existing) {
    const v = await prisma.gradingRuleVersion.create({
      data: { ruleId: rule.id, version: 1, config: DEFAULT_GRADING_CONFIG as unknown as Prisma.InputJsonValue, notes: 'Initial weights: Reel 25, Story 20, Followers 15, Engagement 15, Audience 15, Consistency 10' },
    });
    await prisma.gradingRule.update({ where: { id: rule.id }, data: { activeVersionId: v.id } });
  }

  const integrations = [
    ['instagram', 'AWAITING_APPROVAL', { apiVersion: 'v23.0', scopes: ['instagram_business_basic', 'instagram_business_manage_insights'] }],
    ['tiktok', 'AWAITING_APPROVAL', { scopes: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'] }],
    ['google', 'NOT_CONFIGURED', { scopes: ['openid', 'email', 'profile'] }],
    ['stripe', 'NOT_CONFIGURED', {}],
    ['sandbox_payments', 'HEALTHY', { note: 'Simulated payment provider for development and tests. Never used in production.' }],
    ['llm', 'NOT_CONFIGURED', { note: 'Optional — rules-based parser is used when no LLM provider is configured.' }],
    ['email', 'NOT_CONFIGURED', {}],
    ['sms', 'NOT_CONFIGURED', {}],
  ] as const;
  for (const [provider, status, publicConfig] of integrations) {
    await prisma.integrationConfig.upsert({ where: { provider }, update: {}, create: { provider, status, publicConfig, isEnabled: provider === 'sandbox_payments' } });
  }
  console.log('✔ Platform settings, grading rule v1, integrations');
}

/**
 * SAMPLE benchmark rows. These are illustrative placeholders, clearly flagged `isSample = true`
 * with researchSource = "SAMPLE — not market research". Replace with researched data via the
 * admin UAE Pricing Benchmarks module before relying on them.
 */
async function seedBenchmarks() {
  if ((await prisma.pricingBenchmark.count()) > 0) return;
  const catalog = await prisma.serviceCatalog.findMany();
  const byKey = Object.fromEntries(catalog.map((c) => [c.key, c.id]));
  const tiers = [
    { min: 1_000, max: 10_000, f: 1 },
    { min: 10_001, max: 50_000, f: 2.4 },
    { min: 50_001, max: 250_000, f: 5 },
    { min: 250_001, max: 1_000_000, f: 11 },
    { min: 1_000_001, max: null, f: 22 },
  ];
  const base: Array<[string, 'INSTAGRAM' | 'TIKTOK', number]> = [
    ['ig_single_story', 'INSTAGRAM', 250],
    ['ig_reel', 'INSTAGRAM', 900],
    ['ig_feed_post', 'INSTAGRAM', 650],
    ['tt_video', 'TIKTOK', 800],
  ];
  for (const [key, platform, b] of base) {
    for (const t of tiers) {
      const median = Math.round((b * t.f) / 50) * 50;
      await prisma.pricingBenchmark.create({
        data: {
          platform,
          catalogId: byKey[key],
          followersMin: t.min,
          followersMax: t.max,
          minRate: Math.round(median * 0.6),
          medianRate: median,
          maxRate: Math.round(median * 1.7),
          isSample: true,
          researchSource: 'SAMPLE — illustrative placeholder, not market research',
        },
      });
    }
  }
  console.log(`✔ Pricing benchmarks (SAMPLE): ${await prisma.pricingBenchmark.count()}`);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@influencehub.local').toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✔ Super admin exists: ${email}`);
    return;
  }
  const password = process.env.SEED_ADMIN_PASSWORD || `Ih-${randomBytes(9).toString('base64url')}9a`;
  const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      type: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: role.id } },
      preferences: { create: {} },
    },
  });
  console.log(`✔ Super admin created: ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) console.log(`  Generated password (shown once): ${password}`);
  console.log('  Two-factor authentication must be enrolled on first admin login.');
}

async function main() {
  await seedRbac();
  await seedCategories();
  await seedServiceCatalog();
  await seedSettings();
  await seedBenchmarks();
  await seedAdmin();
  if (process.env.SEED_DEMO_DATA === 'true') {
    if (process.env.APP_ENV === 'production') throw new Error('Refusing to seed demo data in production');
    await seedDemoData(prisma);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
