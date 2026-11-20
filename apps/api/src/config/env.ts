import { z } from 'zod';

const bool = z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean());

const schema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000/api/v1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QUEUE_ENABLED: bool.default(true),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(40), // base64 of 32 random bytes
  COOKIE_DOMAIN: z.string().optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().default(8),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_API_VERSION: z.string().default('v23.0'),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  SOCIAL_SANDBOX_ENABLED: bool.default(false),

  PAYMENT_PROVIDER: z.enum(['sandbox', 'stripe']).default('sandbox'),
  SANDBOX_WEBHOOK_SECRET: z.string().default('sandbox-webhook-secret-change-me'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  LLM_PROVIDER: z.enum(['none', 'anthropic']).default('none'),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('claude-opus-5-5'),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('InfluenceHub <no-reply@influencehub.local>'),
  SMS_PROVIDER: z.enum(['console', 'none']).default('console'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().default(15),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  const e = parsed.data;
  if (e.APP_ENV === 'production') {
    if (e.SOCIAL_SANDBOX_ENABLED) throw new Error('SOCIAL_SANDBOX_ENABLED must be false in production');
    if (e.PAYMENT_PROVIDER === 'sandbox') throw new Error('Sandbox payment provider cannot be used in production');
  }
  cached = e;
  return e;
}

export const isProd = () => env().APP_ENV === 'production';
export const sandboxAllowed = () => env().APP_ENV !== 'production';
