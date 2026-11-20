import { z } from 'zod';
import { toMinor } from './money';

export const agreementClauseSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
});

export const paymentInstalmentSchema = z.object({
  description: z.string().trim().min(1).max(200),
  percentage: z.coerce.number().positive().max(100),
  dueDate: z.string().date().optional().nullable(),
  milestone: z.string().trim().max(200).optional().nullable(),
});

export const financialTermsSchema = z
  .object({
    totalAmount: z
      .string()
      .trim()
      .regex(/^\d{1,9}(\.\d{1,2})?$/, { message: 'validation.invalid' }),
    currency: z.literal('AED').default('AED'),
    vatTreatment: z.enum(['EXCLUSIVE', 'INCLUSIVE', 'NOT_APPLICABLE']),
    paymentSchedule: z.array(paymentInstalmentSchema).min(1).max(12),
    usageRightsDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
    exclusivityDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
    cancellationTerms: z.string().trim().max(3000).optional().nullable(),
    latePaymentTerms: z.string().trim().max(3000).optional().nullable(),
    additionalTerms: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((f) => Math.round(f.paymentSchedule.reduce((a, p) => a + p.percentage, 0) * 100) === 10000, {
    message: 'agreements.scheduleMustTotal100',
    path: ['paymentSchedule'],
  })
  .refine((f) => toMinor(f.totalAmount) > 0, { message: 'validation.invalid', path: ['totalAmount'] });

export const agreementContentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  clauses: z.array(agreementClauseSchema).min(1).max(40),
  financialTerms: financialTermsSchema,
  changeNote: z.string().trim().max(500).optional(),
});

export const agreementCreateSchema = agreementContentSchema.extend({
  counterpartyId: z.string().uuid(), // the other party's business or influencer profile id
  campaignId: z.string().uuid().optional().nullable(),
});

export const agreementSignSchema = z.object({
  versionId: z.string().uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  signerName: z.string().trim().min(3).max(120),
  signerTitle: z.string().trim().max(120).optional(),
  signatureImage: z
    .string()
    .max(300_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  consent: z.literal(true),
});

export type AgreementContent = z.infer<typeof agreementContentSchema>;

/** Stable JSON: object keys sorted recursively, so the same document always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The exact document that is signed (hashed server-side with SHA-256 over canonicalJson). */
export interface SignedAgreementDocument {
  number: string;
  version: number;
  businessId: string;
  influencerId: string;
  title: string;
  clauses: unknown;
  financialTerms: unknown;
}
