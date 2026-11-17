import { env } from '../../../config/env';
import { average, FetchResult, providerFetch, ProviderError, SocialProviderAdapter, TokenSet } from './types';

/**
 * TikTok Login Kit (OAuth v2) + Display API.
 * Docs: developers.tiktok.com/doc/login-kit-web, developers.tiktok.com/doc/display-api-overview
 *
 * Requires an approved TikTok developer app with scopes user.info.basic, user.info.profile,
 * user.info.stats and video.list. TikTok does not expose Story views or private analytics via
 * these APIs — those metrics are reported as unavailable, never estimated.
 */
export class TikTokAdapter implements SocialProviderAdapter {
  readonly platform = 'TIKTOK' as const;
  readonly isSandbox = false;
  static readonly SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];

  private get redirectUri() {
    return `${env().API_PUBLIC_URL}/social/tiktok/callback`;
  }
  isConfigured() {
    return !!(env().TIKTOK_CLIENT_KEY && env().TIKTOK_CLIENT_SECRET);
  }
  usesPkce() {
    return true;
  }

  authorizeUrl(state: string, codeChallenge?: string) {
    const p = new URLSearchParams({
      client_key: env().TIKTOK_CLIENT_KEY!,
      response_type: 'code',
      scope: TikTokAdapter.SCOPES.join(','),
      redirect_uri: this.redirectUri,
      state,
      ...(codeChallenge ? { code_challenge: codeChallenge, code_challenge_method: 'S256' } : {}),
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
  }

  private tokenRequest(params: Record<string, string>) {
    return providerFetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
      body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, client_secret: env().TIKTOK_CLIENT_SECRET!, ...params }),
    });
  }

  private toTokenSet(r: any): TokenSet {
    if (r.error) throw new ProviderError(r.error === 'invalid_grant' ? 'TOKEN_EXPIRED' : 'PROVIDER_ERROR', r.error_description ?? r.error);
    return {
      accessToken: r.access_token,
      refreshToken: r.refresh_token,
      expiresInSeconds: r.expires_in,
      refreshExpiresInSeconds: r.refresh_expires_in,
      scopes: String(r.scope ?? '').split(',').filter(Boolean),
      providerUserId: r.open_id,
      tokenType: r.token_type,
    };
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenSet> {
    if (!this.isConfigured()) throw new ProviderError('NOT_CONFIGURED', 'TikTok credentials missing');
    const r = await this.tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: this.redirectUri, ...(codeVerifier ? { code_verifier: codeVerifier } : {}) });
    return this.toTokenSet(r);
  }

  async refresh(token: { refreshToken?: string }): Promise<TokenSet | null> {
    if (!token.refreshToken) return null;
    return this.toTokenSet(await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refreshToken }));
  }

  async revoke(accessToken: string) {
    await providerFetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env().TIKTOK_CLIENT_KEY!, client_secret: env().TIKTOK_CLIENT_SECRET!, token: accessToken }),
    });
  }

  async fetchAll(accessToken: string): Promise<FetchResult> {
    const unavailable: FetchResult['unavailable'] = [{ metric: 'AVG_STORY_VIEWS', reason: 'Not provided by TikTok APIs' }];
    const fields = 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,username,follower_count,following_count,likes_count,video_count';
    const info = await providerFetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (info.error && info.error.code !== 'ok') throw new ProviderError(info.error.code === 'access_token_invalid' ? 'TOKEN_EXPIRED' : 'PROVIDER_ERROR', info.error.message);
    const u = info.data?.user ?? {};
    const profile = {
      providerAccountId: u.open_id,
      username: u.username ?? u.display_name,
      displayName: u.display_name,
      profileImageUrl: u.avatar_url,
      biography: u.bio_description,
      profileUrl: u.profile_deep_link,
      followers: u.follower_count,
      following: u.following_count,
      mediaCount: u.video_count,
      isVerifiedOnPlatform: u.is_verified,
    };

    const vf = 'id,create_time,cover_image_url,share_url,video_description,duration,title,like_count,comment_count,share_count,view_count';
    let videos: any[] = [];
    try {
      const vl = await providerFetch(`https://open.tiktokapis.com/v2/video/list/?fields=${vf}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ max_count: 20 }),
      });
      videos = vl.data?.videos ?? [];
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'TOKEN_EXPIRED') throw e;
      unavailable.push({ metric: 'AVG_VIDEO_VIEWS', reason: (e as Error).message });
    }
    const posts = videos.map((v) => ({
      providerMediaId: String(v.id),
      mediaType: 'TIKTOK_VIDEO',
      caption: (v.video_description ?? v.title ?? '').slice(0, 2000),
      permalink: v.share_url,
      thumbnailUrl: v.cover_image_url,
      publishedAt: v.create_time ? new Date(v.create_time * 1000) : undefined,
      likes: v.like_count,
      comments: v.comment_count,
      shares: v.share_count,
      views: v.view_count,
    }));
    const metrics: FetchResult['metrics'] = [];
    if (profile.followers != null) metrics.push({ type: 'FOLLOWERS', value: profile.followers });
    if (profile.following != null) metrics.push({ type: 'FOLLOWING', value: profile.following });
    if (u.likes_count != null) metrics.push({ type: 'TOTAL_LIKES', value: u.likes_count });
    if (u.video_count != null) metrics.push({ type: 'VIDEO_COUNT', value: u.video_count });
    const views = average(posts.map((p) => p.views));
    if (views) metrics.push({ type: 'AVG_VIDEO_VIEWS', value: views.value, sampleSize: views.n });
    const withViews = posts.filter((p) => p.views && p.views > 0);
    if (withViews.length) {
      const er = (withViews.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0) / withViews.reduce((a, p) => a + (p.views ?? 0), 0)) * 100;
      metrics.push({ type: 'ENGAGEMENT_RATE', value: Math.round(er * 1000) / 1000, sampleSize: withViews.length });
    }
    unavailable.push({ metric: 'AUDIENCE_COUNTRY', reason: 'Audience demographics are not available via TikTok Display API' });
    return { profile, metrics, posts, audience: [], unavailable, apiVersion: 'v2' };
  }
}
