export type SocialPlatform = 'INSTAGRAM' | 'TIKTOK';

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  refreshExpiresInSeconds?: number;
  scopes: string[];
  providerUserId: string;
  tokenType?: string;
}

export interface SocialProfile {
  providerAccountId: string;
  username: string;
  displayName?: string;
  profileImageUrl?: string;
  biography?: string;
  accountType?: string;
  profileUrl?: string;
  followers?: number;
  following?: number;
  mediaCount?: number;
  isVerifiedOnPlatform?: boolean;
}

export interface FetchedPost {
  providerMediaId: string;
  mediaType: string;
  caption?: string;
  permalink?: string;
  thumbnailUrl?: string;
  publishedAt?: Date;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  reach?: number;
}

export interface FetchedMetric {
  type: 'FOLLOWERS' | 'FOLLOWING' | 'MEDIA_COUNT' | 'AVG_REEL_VIEWS' | 'AVG_STORY_VIEWS' | 'AVG_VIDEO_VIEWS' | 'AVG_LIKES' | 'AVG_COMMENTS' | 'ENGAGEMENT_RATE' | 'REACH' | 'TOTAL_LIKES' | 'VIDEO_COUNT';
  value: number;
  sampleSize?: number;
}

export interface FetchResult {
  profile: SocialProfile;
  metrics: FetchedMetric[];
  posts: FetchedPost[];
  audience: Array<{ dimension: 'COUNTRY' | 'CITY' | 'AGE' | 'GENDER'; key: string; value: number }>;
  /** Metrics that could not be retrieved (insufficient permission, ineligible account, API limits). */
  unavailable: Array<{ metric: string; reason: string }>;
  apiVersion: string;
}

export class ProviderError extends Error {
  constructor(public code: 'TOKEN_EXPIRED' | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'NOT_CONFIGURED' | 'INELIGIBLE_ACCOUNT', message: string, public retryable = false) {
    super(message);
  }
}

export interface SocialProviderAdapter {
  readonly platform: SocialPlatform;
  readonly isSandbox: boolean;
  isConfigured(): boolean;
  authorizeUrl(state: string, codeChallenge?: string): string;
  usesPkce(): boolean;
  exchangeCode(code: string, codeVerifier?: string): Promise<TokenSet>;
  refresh(token: { accessToken: string; refreshToken?: string }): Promise<TokenSet | null>;
  revoke(accessToken: string): Promise<void>;
  fetchAll(accessToken: string, providerAccountId: string): Promise<FetchResult>;
}

/** Shared fetch helper with timeout and provider error mapping. */
export async function providerFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 300) };
    }
    if (res.status === 401 || body?.error?.code === 190) throw new ProviderError('TOKEN_EXPIRED', 'Access token invalid or expired');
    if (res.status === 429 || body?.error?.code === 4 || body?.error?.code === 17) throw new ProviderError('RATE_LIMITED', 'Provider rate limit', true);
    if (res.status === 403 || body?.error?.code === 10 || body?.error?.code === 200) throw new ProviderError('PERMISSION_DENIED', body?.error?.message ?? 'Permission denied');
    if (!res.ok) throw new ProviderError('PROVIDER_ERROR', `HTTP ${res.status}: ${body?.error?.message ?? body?.error_description ?? body?.message ?? 'error'}`, res.status >= 500);
    return body;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError('PROVIDER_ERROR', (e as Error).name === 'AbortError' ? 'Provider timeout' : (e as Error).message, true);
  } finally {
    clearTimeout(t);
  }
}

export function average(nums: Array<number | undefined | null>): { value: number; n: number } | null {
  const v = nums.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  if (!v.length) return null;
  return { value: Math.round(v.reduce((a, b) => a + b, 0) / v.length), n: v.length };
}
