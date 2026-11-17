import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { CATEGORY_SEEDS, EMIRATES, LANGUAGES, SERVICE_CATALOG_SEEDS, type ParsedQuery } from '@influencehub/shared';
import { env } from '../../config/env';

/** Provider-independent interface: any LLM that can turn text into ParsedQuery-shaped JSON. */
export interface QueryUnderstandingProvider {
  readonly name: string;
  isConfigured(): boolean;
  parse(query: string, previous?: Partial<ParsedQuery>): Promise<Partial<ParsedQuery> | null>;
}

const categorySlugs = CATEGORY_SEEDS.flatMap((c) => [c.slug, ...(c.children ?? []).map((ch) => ch.slug)]);
const serviceKeys = SERVICE_CATALOG_SEEDS.map((s) => s.key);

/** Strict validation of model output: only known enum values survive. */
export const llmFiltersSchema = z.object({
  categories: z.array(z.string()).transform((a) => a.filter((s) => categorySlugs.includes(s))),
  emirates: z.array(z.string()).transform((a) => a.filter((s): s is (typeof EMIRATES)[number] => (EMIRATES as readonly string[]).includes(s))),
  platforms: z.array(z.string()).transform((a) => a.filter((s): s is 'INSTAGRAM' | 'TIKTOK' => s === 'INSTAGRAM' || s === 'TIKTOK')),
  languages: z.array(z.string()).transform((a) => a.filter((s) => s in LANGUAGES)),
  serviceTypes: z.array(z.string()).transform((a) => a.filter((s) => serviceKeys.includes(s))),
  gender: z.enum(['FEMALE', 'MALE', 'ANY']).transform((g) => (g === 'ANY' ? undefined : g)),
  minFollowers: z.number().nonnegative().nullable(),
  maxFollowers: z.number().nonnegative().nullable(),
  minViews: z.number().nonnegative().nullable(),
  maxBudget: z.number().nonnegative().nullable(),
  budgetTier: z.enum(['affordable', 'premium', 'any']),
  limit: z.number().int().min(1).max(50).nullable(),
  keywords: z.array(z.string().max(40)).max(10),
});

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories', 'emirates', 'platforms', 'languages', 'serviceTypes', 'gender', 'minFollowers', 'maxFollowers', 'minViews', 'maxBudget', 'budgetTier', 'limit', 'keywords'],
  properties: {
    categories: { type: 'array', items: { type: 'string', enum: categorySlugs } },
    emirates: { type: 'array', items: { type: 'string', enum: [...EMIRATES] } },
    platforms: { type: 'array', items: { type: 'string', enum: ['INSTAGRAM', 'TIKTOK'] } },
    languages: { type: 'array', items: { type: 'string', enum: Object.keys(LANGUAGES) } },
    serviceTypes: { type: 'array', items: { type: 'string', enum: serviceKeys } },
    gender: { type: 'string', enum: ['FEMALE', 'MALE', 'ANY'] },
    minFollowers: { type: ['integer', 'null'] },
    maxFollowers: { type: ['integer', 'null'] },
    minViews: { type: ['integer', 'null'] },
    maxBudget: { type: ['number', 'null'], description: 'Maximum price per service in AED' },
    budgetTier: { type: 'string', enum: ['affordable', 'premium', 'any'] },
    limit: { type: ['integer', 'null'] },
    keywords: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `You convert a business's influencer-search request (English or Arabic) into structured marketplace filters for a UAE influencer marketplace.
Only output filters. Never invent influencers, prices, availability or statistics.
Use category slugs from the schema; prefer the most specific speciality slug (e.g. "dermatology" over "medical-healthcare").
Map cities to emirates (Al Ain -> ABU_DHABI, Khor Fakkan -> SHARJAH). Only set gender when the user explicitly asks for it.
Leave anything not stated empty/null. If refining a previous search, keep previous filters unless the new message changes them.`;

export class AnthropicQueryProvider implements QueryUnderstandingProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicQueryProvider.name);
  private client: Anthropic | null = null;

  isConfigured() {
    return env().LLM_PROVIDER === 'anthropic' && !!env().ANTHROPIC_API_KEY;
  }

  async parse(query: string, previous?: Partial<ParsedQuery>): Promise<Partial<ParsedQuery> | null> {
    if (!this.isConfigured()) return null;
    this.client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
    const user = previous ? `Previous filters: ${JSON.stringify(previous)}\nNew message: ${query}` : query;
    try {
      const res = await this.client.messages.create({
        model: env().LLM_MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: JSON_SCHEMA } },
        messages: [{ role: 'user', content: user }],
      });
      if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
        this.logger.warn(`LLM parse stopped: ${res.stop_reason}`);
        return null; // caller falls back to the deterministic parser
      }
      const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text;
      if (!text) return null;
      const parsed = llmFiltersSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return null;
      const d = parsed.data;
      return {
        categories: d.categories,
        specialities: d.categories.filter((s) => !CATEGORY_SEEDS.some((c) => c.slug === s)),
        emirates: d.emirates,
        platforms: d.platforms,
        languages: d.languages,
        serviceTypes: d.serviceTypes,
        gender: d.gender,
        minFollowers: d.minFollowers ?? undefined,
        maxFollowers: d.maxFollowers ?? undefined,
        minViews: d.minViews ?? undefined,
        maxBudget: d.maxBudget ?? undefined,
        budgetTier: d.budgetTier === 'any' ? undefined : d.budgetTier,
        limit: d.limit ?? undefined,
        keywords: d.keywords,
      };
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) this.logger.warn('LLM rate limited — using rules parser');
      else if (e instanceof Anthropic.APIError) this.logger.warn(`LLM API error ${e.status} — using rules parser`);
      else this.logger.warn(`LLM parse failed: ${(e as Error).message}`);
      return null;
    }
  }
}
