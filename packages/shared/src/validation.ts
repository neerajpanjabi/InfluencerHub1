import { z } from 'zod';
import { EMIRATES } from './constants';

/** UAE mobile/landline in E.164: +971 followed by 8–9 digits. Accepts 05x local format. */
export const uaePhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .transform((v) => (v.startsWith('00971') ? '+' + v.slice(2) : v.startsWith('0') ? '+971' + v.slice(1) : v.startsWith('971') ? '+' + v : v))
  .refine((v) => /^\+971[2-9]\d{7,8}$/.test(v), { message: 'validation.phone' });

export const passwordSchema = z
  .string()
  .min(10, { message: 'validation.passwordMin' })
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), { message: 'validation.passwordComplexity' });

export const emailSchema = z.string().trim().toLowerCase().email({ message: 'validation.email' }).max(254);

export const businessRegistrationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: uaePhoneSchema,
  emirate: z.enum(EMIRATES),
  city: z.string().trim().min(2).max(80),
  categoryIds: z.array(z.string().uuid()).min(1).max(5),
  website: z.string().trim().url().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional(),
  tradeLicenceNumber: z.string().trim().max(60).optional(),
  locale: z.enum(['en', 'ar']).default('en'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'validation.acceptTerms' }) }),
});
export type BusinessRegistration = z.infer<typeof businessRegistrationSchema>;

export const influencerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(60),
  email: emailSchema,
  password: passwordSchema,
  phone: uaePhoneSchema,
  emirate: z.enum(EMIRATES),
  city: z.string().trim().min(2).max(80),
  locale: z.enum(['en', 'ar']).default('en'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'validation.acceptTerms' }) }),
});
export type InfluencerRegistration = z.infer<typeof influencerRegistrationSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export const influencerProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  displayName: z.string().trim().min(2).max(60).optional(),
  displayNameAr: z.string().trim().max(60).optional().nullable(),
  bio: z.string().trim().max(1500).optional().nullable(),
  bioAr: z.string().trim().max(1500).optional().nullable(),
  phone: uaePhoneSchema.optional(),
  emirate: z.enum(EMIRATES).optional(),
  city: z.string().trim().max(80).optional(),
  gender: z.enum(['FEMALE', 'MALE', 'UNDISCLOSED']).optional(),
  languages: z.array(z.string().min(2).max(5)).max(10).optional(),
  specialities: z.array(z.string().trim().max(60)).max(15).optional(),
  contentNiches: z.array(z.string().trim().max(60)).max(15).optional(),
  audienceLocations: z.array(z.string().max(20)).max(10).optional(),
  categoryIds: z.array(z.string().uuid()).max(8).optional(),
  primaryCategoryId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
  acceptingBookings: z.boolean().optional(),
  visibility: z
    .object({
      showCity: z.boolean(),
      showGender: z.boolean(),
      showAudience: z.boolean(),
      showStoryViews: z.boolean(),
      showLanguages: z.boolean(),
    })
    .partial()
    .optional(),
  advertiserPermitNumber: z.string().trim().max(60).optional().nullable(),
  advertiserPermitExpiry: z.string().date().optional().nullable(),
});

export const serviceUpsertSchema = z.object({
  catalogKey: z.string().min(2).max(60),
  title: z.string().trim().min(2).max(120),
  titleAr: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  descriptionAr: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().positive().max(10_000_000),
  promoPrice: z.coerce.number().positive().max(10_000_000).optional().nullable(),
  promoEndsAt: z.string().datetime().optional().nullable(),
  minimumPrice: z.coerce.number().positive().optional().nullable(),
  deliveryDays: z.coerce.number().int().min(1).max(180),
  revisions: z.coerce.number().int().min(0).max(10),
  usageRights: z.string().trim().max(300).optional().nullable(),
  usageRightsDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  exclusivityDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  addOns: z.array(z.object({ key: z.string().max(40), name: z.string().max(80), price: z.coerce.number().nonnegative() })).max(10).optional(),
  taxTreatment: z.enum(['STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE']).default('STANDARD'),
  status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE'),
}).refine((v) => v.promoPrice == null || v.promoPrice < v.price, { message: 'validation.promoBelowPrice', path: ['promoPrice'] })
  .refine((v) => v.minimumPrice == null || v.minimumPrice <= v.price, { message: 'validation.minimumAbovePrice', path: ['minimumPrice'] });

export const manualMetricSchema = z.object({
  socialAccountId: z.string().uuid(),
  metricType: z.enum(['FOLLOWERS', 'AVG_REEL_VIEWS', 'AVG_STORY_VIEWS', 'AVG_VIDEO_VIEWS', 'ENGAGEMENT_RATE']),
  value: z.coerce.number().nonnegative().max(1_000_000_000),
  sampleSize: z.coerce.number().int().min(0).max(1000).optional(),
  evidenceAttachmentId: z.string().uuid().optional(),
});

export const quotationRequestSchema = z.object({
  influencerId: z.string().uuid(),
  brief: z.string().trim().min(20).max(5000),
  requestedBudget: z.coerce.number().positive().max(10_000_000).optional(),
});

export const quotationSubmitSchema = z.object({
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(300),
        platform: z.enum(['INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE']),
        quantity: z.coerce.number().int().min(1).max(100),
        unitPrice: z.coerce.number().positive().max(10_000_000),
        deliveryDays: z.coerce.number().int().min(1).max(365),
      }),
    )
    .min(1)
    .max(20),
  validDays: z.coerce.number().int().min(1).max(60).default(14),
  note: z.string().trim().max(2000).optional(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
});
