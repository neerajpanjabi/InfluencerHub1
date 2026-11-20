/* eslint-disable no-console */
/**
 * DEMO / SANDBOX data for local development and automated tests ONLY.
 *  - Every social account is flagged `isSandbox = true`.
 *  - Every metric is stored with source = SANDBOX so the UI renders a "Sandbox data" label.
 *  - Never runs when APP_ENV=production (guarded in index.ts and here).
 * Demo creators are fictional. Their statistics are synthetic and must not be presented as real.
 */
import { PrismaClient, Prisma, Emirate, Gender, Platform } from '@prisma/client';
import * as argon2 from 'argon2';
import { computeGrade, DEFAULT_GRADING_CONFIG, suggestPrice } from '@influencehub/shared';

export const DEMO_PASSWORD = 'DemoPass2026!';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface DemoCreator {
  name: string;
  nameAr: string;
  slug: string;
  gender: Gender;
  emirate: Emirate;
  city: string;
  categories: string[];
  languages: string[];
  ig?: number; // followers
  tt?: number;
  medical?: boolean;
  bio: string;
}

const CREATORS: DemoCreator[] = [
  { name: 'Dr. Layla Haddad', nameAr: 'د. ليلى حداد', slug: 'dr-layla-haddad', gender: 'FEMALE', emirate: 'DUBAI', city: 'Dubai', categories: ['medical-healthcare', 'dermatology', 'cosmetic-dermatology'], languages: ['en', 'ar'], ig: 184000, tt: 92000, medical: true, bio: 'Dermatologist sharing evidence-based skincare. (Demo profile)' },
  { name: 'Dr. Omar Siddiqui', nameAr: 'د. عمر صديقي', slug: 'dr-omar-siddiqui', gender: 'MALE', emirate: 'DUBAI', city: 'Dubai', categories: ['medical-healthcare', 'dentistry', 'orthodontics'], languages: ['en', 'ur', 'hi'], ig: 46000, medical: true, bio: 'Orthodontist. Smile makeovers explained. (Demo profile)' },
  { name: 'Dr. Mariam Al Nuaimi', nameAr: 'د. مريم النعيمي', slug: 'dr-mariam-al-nuaimi', gender: 'FEMALE', emirate: 'ABU_DHABI', city: 'Abu Dhabi', categories: ['medical-healthcare', 'nutrition', 'dietetics'], languages: ['ar', 'en'], ig: 71000, tt: 38000, medical: true, bio: 'Clinical dietitian. Healthy Emirati recipes. (Demo profile)' },
  { name: 'Aisha Rahman', nameAr: 'عائشة رحمن', slug: 'aisha-rahman', gender: 'FEMALE', emirate: 'SHARJAH', city: 'Sharjah', categories: ['restaurants-food'], languages: ['en', 'ml', 'hi'], ig: 28500, tt: 41000, bio: 'Sharjah food explorer — hidden gems & family dining. (Demo profile)' },
  { name: 'Fahad Al Mansoori', nameAr: 'فهد المنصوري', slug: 'fahad-al-mansoori', gender: 'MALE', emirate: 'DUBAI', city: 'Dubai', categories: ['real-estate', 'business-entrepreneurship'], languages: ['ar', 'en'], ig: 320000, tt: 150000, bio: 'Luxury villas & off-plan market insights. (Demo profile)' },
  { name: 'Priya Menon', nameAr: 'بريا مينون', slug: 'priya-menon', gender: 'FEMALE', emirate: 'DUBAI', city: 'Dubai', categories: ['beauty-salons', 'fashion-lifestyle'], languages: ['en', 'ml', 'ta'], ig: 62000, tt: 18000, bio: 'Beauty, saree styling and salon reviews. (Demo profile)' },
  { name: 'Noura Al Ketbi', nameAr: 'نورة الكتبي', slug: 'noura-al-ketbi', gender: 'FEMALE', emirate: 'ABU_DHABI', city: 'Abu Dhabi', categories: ['jewellery-luxury', 'fashion-lifestyle'], languages: ['ar', 'en'], ig: 540000, bio: 'Haute joaillerie & modest luxury fashion. (Demo profile)' },
  { name: 'Rashid Khan', nameAr: 'راشد خان', slug: 'rashid-khan', gender: 'MALE', emirate: 'AJMAN', city: 'Ajman', categories: ['retail-hypermarkets', 'restaurants-food'], languages: ['ur', 'hi', 'en'], tt: 210000, ig: 35000, bio: 'Grocery hauls, deals and store openings. (Demo profile)' },
  { name: 'Maria Santos', nameAr: 'ماريا سانتوس', slug: 'maria-santos', gender: 'FEMALE', emirate: 'DUBAI', city: 'Dubai', categories: ['retail-hypermarkets', 'parenting-family'], languages: ['tl', 'en'], tt: 88000, ig: 22000, bio: 'Budget family life in Dubai. (Demo profile)' },
  { name: 'Khalid Al Shamsi', nameAr: 'خالد الشامسي', slug: 'khalid-al-shamsi', gender: 'MALE', emirate: 'RAS_AL_KHAIMAH', city: 'Ras Al Khaimah', categories: ['hospitality-tourism', 'travel'], languages: ['ar', 'en'], ig: 128000, tt: 64000, bio: 'Adventures from Jebel Jais to the coast. (Demo profile)' },
  { name: 'Sara Petrova', nameAr: 'سارة بيتروفا', slug: 'sara-petrova', gender: 'FEMALE', emirate: 'DUBAI', city: 'Dubai', categories: ['fitness-sports'], languages: ['ru', 'en'], ig: 97000, tt: 120000, bio: 'Pilates & functional fitness. (Demo profile)' },
  { name: 'Yousef Haddad', nameAr: 'يوسف حداد', slug: 'yousef-haddad', gender: 'MALE', emirate: 'DUBAI', city: 'Dubai', categories: ['technology-electronics'], languages: ['ar', 'en'], tt: 410000, ig: 150000, bio: 'Gadget reviews in Arabic. (Demo profile)' },
  { name: 'Hessa Al Zaabi', nameAr: 'حصة الزعابي', slug: 'hessa-al-zaabi', gender: 'FEMALE', emirate: 'FUJAIRAH', city: 'Fujairah', categories: ['home-living', 'parenting-family'], languages: ['ar'], ig: 19000, bio: 'Home styling & family moments. (Demo profile)' },
  { name: 'Arjun Nair', nameAr: 'أرجون ناير', slug: 'arjun-nair', gender: 'MALE', emirate: 'SHARJAH', city: 'Sharjah', categories: ['education-schools', 'technology-electronics'], languages: ['ml', 'en', 'hi'], ig: 12500, tt: 9000, bio: 'Study tips & EdTech for UAE students. (Demo profile)' },
  { name: 'Lina Barakat', nameAr: 'لينا بركات', slug: 'lina-barakat', gender: 'FEMALE', emirate: 'DUBAI', city: 'Dubai', categories: ['events-entertainment', 'restaurants-food'], languages: ['ar', 'en', 'fr'], ig: 230000, tt: 75000, bio: 'Dubai nightlife, brunches & events. (Demo profile)' },
  { name: 'Hamad Al Suwaidi', nameAr: 'حمد السويدي', slug: 'hamad-al-suwaidi', gender: 'MALE', emirate: 'ABU_DHABI', city: 'Al Ain', categories: ['automotive'], languages: ['ar'], ig: 88000, tt: 140000, bio: 'Cars, desert drives & dealership reviews. (Demo profile)' },
  { name: 'Fatima Zahra', nameAr: 'فاطمة الزهراء', slug: 'fatima-zahra', gender: 'FEMALE', emirate: 'UMM_AL_QUWAIN', city: 'Umm Al Quwain', categories: ['pets-animals'], languages: ['ar', 'en'], ig: 6400, bio: 'Rescue cats & pet care. New creator — not enough data yet. (Demo profile)' },
  { name: 'Dr. Ahmed Fathy', nameAr: 'د. أحمد فتحي', slug: 'dr-ahmed-fathy', gender: 'MALE', emirate: 'SHARJAH', city: 'Sharjah', categories: ['medical-healthcare', 'physiotherapy', 'orthopaedics'], languages: ['ar', 'en'], ig: 33000, tt: 51000, medical: true, bio: 'Physiotherapist — posture & sports injury tips. (Demo profile)' },
];

const SERVICE_SETS: Record<string, string[]> = {
  INSTAGRAM: ['ig_single_story', 'ig_story_3', 'ig_reel', 'ig_reel_story_3'],
  TIKTOK: ['tt_video', 'tt_product_review'],
  BOTH: ['x_reel_tt_video'],
  EXTRA: ['ugc_video', 'store_visit'],
};

export async function seedDemoData(prisma: PrismaClient) {
  if (process.env.APP_ENV === 'production') throw new Error('Demo data is not allowed in production');
  if (await prisma.influencerProfile.findUnique({ where: { slug: CREATORS[0].slug } })) {
    console.log('✔ Demo data already present');
    return;
  }
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const catBySlug = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.slug, c]));
  const catalog = Object.fromEntries((await prisma.serviceCatalog.findMany()).map((c) => [c.key, c]));
  const roleInf = await prisma.role.findUniqueOrThrow({ where: { key: 'INFLUENCER' } });
  const roleBiz = await prisma.role.findUniqueOrThrow({ where: { key: 'BUSINESS' } });
  const ruleVersion = await prisma.gradingRuleVersion.findFirstOrThrow({ orderBy: { version: 'desc' } });
  const now = new Date();
  const rand = rng(42);

  // ── Businesses
  const businesses = [
    { email: 'clinic@demo.influencehub.local', name: 'Marina Skin Clinic (Demo)', contact: 'Hana Youssef', emirate: 'DUBAI' as Emirate, city: 'Dubai', cat: 'medical-healthcare' },
    { email: 'bistro@demo.influencehub.local', name: 'Corniche Bistro (Demo)', contact: 'Sami Aziz', emirate: 'SHARJAH' as Emirate, city: 'Sharjah', cat: 'restaurants-food' },
    { email: 'jewels@demo.influencehub.local', name: 'Gold Souk Jewels (Demo)', contact: 'Rana Patel', emirate: 'DUBAI' as Emirate, city: 'Dubai', cat: 'jewellery-luxury' },
  ];
  for (const b of businesses) {
    await prisma.user.create({
      data: {
        email: b.email,
        passwordHash,
        type: 'BUSINESS',
        emailVerifiedAt: now,
        phone: '+971501110000',
        roles: { create: { roleId: roleBiz.id } },
        preferences: { create: {} },
        businessProfile: {
          create: {
            businessName: b.name,
            contactPerson: b.contact,
            businessEmail: b.email,
            emirate: b.emirate,
            city: b.city,
            description: 'Fictional demo business for sandbox testing.',
            onboardingCompleted: true,
            verificationStatus: 'VERIFIED',
            categories: { create: { categoryId: catBySlug[b.cat].id } },
          },
        },
      },
    });
  }

  // ── Influencers
  let idx = 0;
  for (const c of CREATORS) {
    idx++;
    const primaryCat = c.categories.find((s) => !catBySlug[s].parentId) ?? c.categories[0];
    const user = await prisma.user.create({
      data: {
        email: `${c.slug}@demo.influencehub.local`,
        passwordHash,
        type: 'INFLUENCER',
        emailVerifiedAt: now,
        phone: `+97150${String(2000000 + idx).padStart(7, '0')}`,
        roles: { create: { roleId: roleInf.id } },
        preferences: { create: {} },
      },
    });
    const profile = await prisma.influencerProfile.create({
      data: {
        userId: user.id,
        slug: c.slug,
        fullName: c.name,
        displayName: c.name,
        displayNameAr: c.nameAr,
        bio: c.bio,
        emirate: c.emirate,
        city: c.city,
        gender: c.gender,
        languages: c.languages,
        audienceLocations: ['AE'],
        isPublic: true,
        onboardingCompleted: true,
        isFeatured: idx <= 6,
        identityStatus: idx % 5 === 0 ? 'PENDING' : 'VERIFIED',
        isMedicalProfessional: !!c.medical,
        medicalStatus: c.medical ? 'VERIFIED' : 'UNVERIFIED',
        visibility: { showCity: true, showGender: true, showAudience: true, showStoryViews: true, showLanguages: true },
        categories: { create: c.categories.map((slug) => ({ categoryId: catBySlug[slug].id, isPrimary: slug === primaryCat })) },
      },
    });
    if (c.medical) {
      await prisma.medicalCredential.create({
        data: { influencerId: profile.id, profession: 'Physician (demo)', speciality: c.categories[1], licensingAuthority: c.emirate === 'DUBAI' ? 'DHA' : c.emirate === 'ABU_DHABI' ? 'DOH' : 'MOHAP', licenceNumber: `DEMO-${1000 + idx}`, status: 'VERIFIED', reviewNotes: 'Demo credential — not a real licence' },
      });
    }

    const metricsFor: Record<string, any> = {};
    const isNew = c.slug === 'fatima-zahra';
    for (const [platform, followers] of [['INSTAGRAM', c.ig], ['TIKTOK', c.tt]] as const) {
      if (!followers) continue;
      const acc = await prisma.socialAccount.create({
        data: {
          influencerId: profile.id,
          platform,
          providerAccountId: `sandbox-${platform.toLowerCase()}-${c.slug}`,
          username: c.slug.replace(/-/g, '.'),
          displayName: c.name,
          accountType: platform === 'INSTAGRAM' ? 'MEDIA_CREATOR' : null,
          status: 'CONNECTED',
          isSandbox: true,
          isPrimary: platform === 'INSTAGRAM' || !c.ig,
          lastSyncedAt: now,
          apiVersion: 'sandbox',
        },
      });
      const views = Math.round(followers * (0.18 + rand() * 0.5));
      const story = Math.round(followers * (0.04 + rand() * 0.08));
      const eng = Math.round((1.2 + rand() * 6) * 100) / 100;
      const sample = isNew ? 2 : 12;
      const metricRows: Array<[string, number, number | null]> = [
        ['FOLLOWERS', followers, null],
        ['ENGAGEMENT_RATE', eng, sample],
      ];
      if (platform === 'INSTAGRAM') metricRows.push(['AVG_REEL_VIEWS', views, sample], ['AVG_STORY_VIEWS', story, sample]);
      else metricRows.push(['AVG_VIDEO_VIEWS', Math.round(views * 1.3), sample]);
      // History: 4 monthly snapshots so growth charts have data
      for (let m = 3; m >= 0; m--) {
        const at = new Date(now.getTime() - m * 30 * 86_400_000);
        const growth = 1 - m * 0.03;
        for (const [type, value, ss] of metricRows) {
          await prisma.socialMetricSnapshot.create({
            data: {
              socialAccountId: acc.id,
              platform,
              metricType: type as any,
              value: new Prisma.Decimal(type === 'ENGAGEMENT_RATE' ? value : Math.round(value * growth)),
              sampleSize: ss,
              source: 'SANDBOX',
              verificationStatus: 'API_VERIFIED',
              apiVersion: 'sandbox',
              collectedAt: at,
            },
          });
        }
      }
      await prisma.audienceInsight.create({
        data: { socialAccountId: acc.id, dimension: 'COUNTRY', key: 'AE', value: new Prisma.Decimal(Math.round((0.45 + rand() * 0.4) * 1000) / 1000), source: 'SANDBOX', verificationStatus: 'API_VERIFIED', collectedAt: now },
      });
      await prisma.socialSyncLog.create({ data: { socialAccountId: acc.id, status: 'SUCCEEDED', trigger: 'CONNECT', finishedAt: now, metricsWritten: metricRows.length * 4 } });
      const m = (v: number, ss: number | null = null) => ({ value: v, verification: 'API_VERIFIED' as const, collectedAt: now, sampleSize: ss });
      metricsFor[platform] =
        platform === 'INSTAGRAM'
          ? { followers: m(followers), avgReelViews: m(views, sample), avgStoryViews: m(story, sample), engagementRate: m(eng, sample), postsLast30Days: isNew ? 1 : 6 + Math.floor(rand() * 8), viewsCoefficientOfVariation: 0.3 + rand() * 0.6 }
          : { followers: m(followers), avgVideoViews: m(Math.round(views * 1.3), sample), engagementRate: m(eng, sample), postsLast30Days: isNew ? 1 : 5 + Math.floor(rand() * 10) };
    }

    const result = computeGrade({
      instagram: metricsFor.INSTAGRAM,
      tiktok: metricsFor.TIKTOK,
      audienceTargetMarketShare: isNew ? undefined : { value: 0.6, verification: 'API_VERIFIED', collectedAt: now },
      primaryCategorySlug: primaryCat,
      now,
    }, DEFAULT_GRADING_CONFIG);
    await prisma.influencerScore.create({
      data: { influencerId: profile.id, ruleVersionId: ruleVersion.id, score: result.score, grade: result.grade, breakdown: result as any, dataCoverage: result.coverage },
    });
    await prisma.influencerScoreHistory.create({ data: { influencerId: profile.id, score: result.score, grade: result.grade, ruleVersion: 1, breakdown: result as any } });

    // ── Services
    const keys = [
      ...(c.ig ? SERVICE_SETS.INSTAGRAM : []),
      ...(c.tt ? SERVICE_SETS.TIKTOK : []),
      ...(c.ig && c.tt ? SERVICE_SETS.BOTH : []),
      ...SERVICE_SETS.EXTRA.slice(0, idx % 2 === 0 ? 2 : 1),
    ];
    let minPrice: number | null = null;
    for (const key of keys) {
      const cat = catalog[key];
      const platform = cat.platform as Platform;
      const avgViews = platform === 'TIKTOK' ? metricsFor.TIKTOK?.avgVideoViews?.value : metricsFor.INSTAGRAM?.avgReelViews?.value;
      const suggestion = suggestPrice({
        serviceKey: key,
        platform: platform as any,
        followers: (c.ig ?? 0) + (c.tt ?? 0),
        avgViews,
        grade: result.grade,
        categorySlug: primaryCat,
        emirate: c.emirate,
        languages: c.languages,
        complexityFactor: Number(cat.complexityFactor),
      });
      const price = Math.max(150, Math.round((suggestion.suggested * (0.85 + rand() * 0.3)) / 50) * 50);
      minPrice = minPrice == null ? price : Math.min(minPrice, price);
      await prisma.influencerService.create({
        data: {
          influencerId: profile.id,
          catalogId: cat.id,
          title: cat.nameEn,
          titleAr: cat.nameAr,
          description: `${cat.nameEn} by ${c.name}. Includes concept, filming, editing and one round of revisions.`,
          platform,
          deliverables: cat.defaultDeliverables as Prisma.InputJsonValue,
          price,
          suggestedPrice: suggestion.suggested,
          deliveryDays: 5 + (idx % 5),
          revisions: 1,
          usageRights: 'Organic posting on creator channels. Paid usage available on request.',
          taxTreatment: 'STANDARD',
          status: 'ACTIVE',
        },
      });
    }

    const igM = metricsFor.INSTAGRAM;
    const ttM = metricsFor.TIKTOK;
    await prisma.influencerProfile.update({
      where: { id: profile.id },
      data: {
        currentScore: result.score,
        currentGrade: result.grade,
        totalFollowers: (c.ig ?? 0) + (c.tt ?? 0),
        avgReelViews: igM?.avgReelViews?.value ?? null,
        avgStoryViews: igM?.avgStoryViews?.value ?? null,
        avgVideoViews: ttM?.avgVideoViews?.value ?? null,
        engagementRate: igM?.engagementRate?.value ?? ttM?.engagementRate?.value ?? null,
        startingPrice: minPrice,
        searchText: [c.name, c.nameAr, c.bio, c.city, ...c.categories.flatMap((s) => [catBySlug[s].nameEn, catBySlug[s].nameAr])].join(' ').toLowerCase(),
      },
    });
  }
  console.log(`✔ Demo data: ${businesses.length} businesses, ${CREATORS.length} creators (sandbox metrics). Password: ${DEMO_PASSWORD}`);
}
