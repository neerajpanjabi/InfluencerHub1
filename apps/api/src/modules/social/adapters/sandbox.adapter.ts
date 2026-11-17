import { createHash } from 'crypto';
import { env, sandboxAllowed } from '../../../config/env';
import { FetchResult, ProviderError, SocialPlatform, SocialProviderAdapter, TokenSet } from './types';

/**
 * SANDBOX social provider — for local development, demos and automated tests only.
 * Implements the full OAuth round-trip against a local consent page and returns deterministic
 * synthetic data. All data written from this adapter is stored with source = SANDBOX and the
 * account is flagged isSandbox, so it is visibly labelled and excluded from production grading.
 * Disabled in production (env guard) and whenever SOCIAL_SANDBOX_ENABLED is false.
 */
export class SandboxSocialAdapter implements SocialProviderAdapter {
  readonly isSandbox = true;
  constructor(readonly platform: SocialPlatform) {}

  isConfigured() {
    return env().SOCIAL_SANDBOX_ENABLED && sandboxAllowed();
  }
  usesPkce() {
    return this.platform === 'TIKTOK';
  }
  authorizeUrl(state: string, codeChallenge?: string) {
    const p = new URLSearchParams({ state, platform: this.platform, ...(codeChallenge ? { code_challenge: codeChallenge } : {}) });
    return `${env().API_PUBLIC_URL}/social/sandbox/authorize?${p}`;
  }

  private assertEnabled() {
    if (!this.isConfigured()) throw new ProviderError('NOT_CONFIGURED', 'Sandbox social provider disabled');
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    this.assertEnabled();
    const m = /^sandbox\.([a-z0-9._]{2,30})$/.exec(code);
    if (!m) throw new ProviderError('PROVIDER_ERROR', 'Invalid sandbox authorization code');
    const username = m[1];
    return {
      accessToken: `sbx_at_${this.platform}_${username}_${Date.now()}`,
      refreshToken: this.platform === 'TIKTOK' ? `sbx_rt_${username}` : undefined,
      expiresInSeconds: this.platform === 'TIKTOK' ? 86_400 : 60 * 86_400,
      refreshExpiresInSeconds: this.platform === 'TIKTOK' ? 365 * 86_400 : undefined,
      scopes: this.platform === 'INSTAGRAM' ? ['instagram_business_basic', 'instagram_business_manage_insights'] : ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'],
      providerUserId: `sandbox-${this.platform.toLowerCase()}-${username}`,
    };
  }

  async refresh(token: { accessToken: string; refreshToken?: string }) {
    this.assertEnabled();
    const username = token.accessToken.split('_')[3] ?? 'user';
    return this.exchangeCode(`sandbox.${username}`);
  }

  async revoke() {
    /* nothing to revoke */
  }

  async fetchAll(accessToken: string, providerAccountId: string): Promise<FetchResult> {
    this.assertEnabled();
    if (accessToken.includes('expired')) throw new ProviderError('TOKEN_EXPIRED', 'Sandbox token expired');
    const username = providerAccountId.replace(/^sandbox-(instagram|tiktok)-/, '');
    const h = createHash('sha256').update(`${this.platform}:${username}`).digest();
    const r = (i: number) => h[i % h.length] / 255;
    const followers = Math.round(3_000 + r(0) * r(1) * 400_000);
    const now = Date.now();
    const posts = Array.from({ length: 12 }, (_, i) => {
      const views = Math.round(followers * (0.15 + r(i + 2) * 0.6));
      return {
        providerMediaId: `sbx-${username}-${i}`,
        mediaType: this.platform === 'INSTAGRAM' ? (i % 3 === 0 ? 'IMAGE' : 'REEL') : 'TIKTOK_VIDEO',
        caption: `Sandbox post ${i + 1}`,
        publishedAt: new Date(now - i * 3 * 86_400_000),
        likes: Math.round(views * (0.03 + r(i + 5) * 0.05)),
        comments: Math.round(views * 0.004),
        shares: Math.round(views * 0.002),
        views,
        reach: Math.round(views * 0.8),
      };
    });
    if (this.platform === 'INSTAGRAM') {
      for (let i = 0; i < 6; i++) posts.push({ providerMediaId: `sbx-${username}-story-${now - i}`, mediaType: 'STORY', caption: '', publishedAt: new Date(now - i * 4 * 3600_000), likes: 0, comments: 0, shares: 0, views: Math.round(followers * (0.04 + r(i + 9) * 0.06)), reach: 0 });
    }
    return {
      profile: {
        providerAccountId,
        username,
        displayName: username.replace(/[._]/g, ' '),
        accountType: this.platform === 'INSTAGRAM' ? 'MEDIA_CREATOR' : undefined,
        profileUrl: undefined,
        followers,
        following: Math.round(200 + r(3) * 800),
        mediaCount: 120 + Math.round(r(4) * 500),
      },
      metrics: [], // computed by SocialService from posts, same as live providers
      posts,
      audience: [
        { dimension: 'COUNTRY', key: 'AE', value: 0.45 + r(6) * 0.35 },
        { dimension: 'COUNTRY', key: 'IN', value: 0.1 },
      ],
      unavailable: this.platform === 'TIKTOK' ? [{ metric: 'AVG_STORY_VIEWS', reason: 'Not provided by TikTok APIs' }] : [],
      apiVersion: 'sandbox',
    };
  }
}
