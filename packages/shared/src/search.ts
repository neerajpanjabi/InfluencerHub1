import { z } from 'zod';
import { EMIRATES, PLATFORMS, GRADES } from './constants';

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v == null || v === '') return undefined;
    if (Array.isArray(v)) return v;
    return String(v).split(',').map((s) => s.trim()).filter(Boolean);
  }, z.array(item).optional());

const num = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().finite().nonnegative().optional());

export const SORT_OPTIONS = ['relevance', 'grade', 'followers', 'views', 'engagement', 'price_asc', 'price_desc', 'newest'] as const;

export const influencerSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  platform: csv(z.enum(PLATFORMS)),
  category: csv(z.string().max(80)), // category slugs (parent or child)
  emirate: csv(z.enum(EMIRATES)),
  city: z.string().max(80).optional(),
  language: csv(z.string().max(5)),
  gender: z.enum(['FEMALE', 'MALE']).optional(),
  grade: csv(z.enum(GRADES)),
  minFollowers: num,
  maxFollowers: num,
  minReelViews: num,
  minStoryViews: num,
  minVideoViews: num,
  minEngagement: num,
  minPrice: num,
  maxPrice: num,
  serviceType: csv(z.string().max(60)), // service catalog keys
  audienceLocation: csv(z.string().max(20)),
  verifiedOnly: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
  medicalVerifiedOnly: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
  availableOnly: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
  sort: z.enum(SORT_OPTIONS).default('relevance'),
  page: z.preprocess((v) => (v == null || v === '' ? 1 : Number(v)), z.number().int().min(1).max(500)).default(1),
  pageSize: z.preprocess((v) => (v == null || v === '' ? 24 : Number(v)), z.number().int().min(1).max(60)).default(24),
});

export type InfluencerSearchParams = z.infer<typeof influencerSearchSchema>;

/** Serialise filters back into a query string (for links / AI → browse handoff). */
export function toSearchQuery(params: Partial<InfluencerSearchParams>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'page' && v === 1) continue;
    if (k === 'sort' && v === 'relevance') continue;
    if (k === 'pageSize' && v === 24) continue;
    usp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return usp.toString();
}
