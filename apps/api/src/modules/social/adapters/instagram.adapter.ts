import { env } from '../../../config/env';
import { average, FetchResult, FetchedPost, providerFetch, ProviderError, SocialProviderAdapter, TokenSet } from './types';

/**
 * Instagram API with Instagram Login (official Meta API for professional — Business/Creator — accounts).
 * Docs: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * Requires a Meta app with the Instagram product, approved permissions
 * `instagram_business_basic` and `instagram_business_manage_insights` (App Review),
 * and a professional account. Personal accounts cannot grant insights.
 * Nothing here scrapes or uses unofficial endpoints; unavailable metrics are reported as such.
 */
export class InstagramAdapter implements SocialProviderAdapter {
  readonly platform = 'INSTAGRAM' as const;
  readonly isSandbox = false;
  static readonly SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'];

  private get version() {
    return env().INSTAGRAM_API_VERSION;
  }
  private get redirectUri() {
    return `${env().API_PUBLIC_URL}/social/instagram/callback`;
  }

  isConfigured() {
    return !!(env().INSTAGRAM_APP_ID && env().INSTAGRAM_APP_SECRET);
  }
  usesPkce() {
    return false; // Instagram Login uses confidential client + state
  }

  authorizeUrl(state: string) {
    const p = new URLSearchParams({
      client_id: env().INSTAGRAM_APP_ID!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: InstagramAdapter.SCOPES.join(','),
      state,
      enable_fb_login: '0',
    });
    return `https://www.instagram.com/oauth/authorize?${p}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    if (!this.isConfigured()) throw new ProviderError('NOT_CONFIGURED', 'Instagram app credentials missing');
    // 1) short-lived token (1h)
    const short = await providerFetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env().INSTAGRAM_APP_ID!,
        client_secret: env().INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code: code.replace(/#_$/, ''),
      }),
    });
    const data = Array.isArray(short.data) ? short.data[0] : short;
    // 2) exchange for long-lived token (60 days)
    const long = await providerFetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: env().INSTAGRAM_APP_SECRET!, access_token: data.access_token })}`,
    );
    const granted = typeof data.permissions === 'string' ? data.permissions.split(',') : Array.isArray(data.permissions) ? data.permissions : InstagramAdapter.SCOPES;
    return {
      accessToken: long.access_token,
      expiresInSeconds: long.expires_in,
      scopes: granted,
      providerUserId: String(data.user_id),
      tokenType: long.token_type,
    };
  }

  /** Long-lived tokens can be refreshed once they are at least 24h old and not expired. */
  async refresh(token: { accessToken: string }): Promise<TokenSet | null> {
    const r = await providerFetch(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token.accessToken })}`);
    return { accessToken: r.access_token, expiresInSeconds: r.expires_in, scopes: InstagramAdapter.SCOPES, providerUserId: '' };
  }

  async revoke(): Promise<void> {
    // Instagram Login has no token revocation endpoint; users remove app access from Instagram
    // settings. We delete our stored token (handled by SocialService) — documented in INTEGRATION_SETUP.md.
  }

  private url(path: string, params: Record<string, string>, token: string) {
    return `https://graph.instagram.com/${this.version}/${path}?${new URLSearchParams({ ...params, access_token: token })}`;
  }

  async fetchAll(accessToken: string): Promise<FetchResult> {
    const unavailable: FetchResult['unavailable'] = [];
    const me = await providerFetch(
      this.url('me', { fields: 'user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count,biography' }, accessToken),
    );
    const profile = {
      providerAccountId: String(me.user_id ?? me.id),
      username: me.username,
      displayName: me.name,
      profileImageUrl: me.profile_picture_url,
      biography: me.biography,
      accountType: me.account_type,
      profileUrl: `https://www.instagram.com/${me.username}`,
      followers: me.followers_count,
      following: me.follows_count,
      mediaCount: me.media_count,
    };

    const media = await providerFetch(
      this.url('me/media', { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp,like_count,comments_count', limit: '30' }, accessToken),
    );
    const posts: FetchedPost[] = [];
    for (const m of (media.data ?? []) as any[]) {
      const isReel = m.media_product_type === 'REELS';
      let views: number | undefined;
      let reach: number | undefined;
      let saves: number | undefined;
      let shares: number | undefined;
      try {
        const metrics = isReel ? 'views,reach,saved,shares' : 'reach,saved,shares';
        const ins = await providerFetch(this.url(`${m.id}/insights`, { metric: metrics }, accessToken));
        for (const row of ins.data ?? []) {
          const v = row.values?.[0]?.value ?? row.total_value?.value;
          if (row.name === 'views') views = v;
          if (row.name === 'reach') reach = v;
          if (row.name === 'saved') saves = v;
          if (row.name === 'shares') shares = v;
        }
      } catch (e) {
        if (e instanceof ProviderError && e.code === 'TOKEN_EXPIRED') throw e;
        if (!unavailable.find((u) => u.metric === 'MEDIA_INSIGHTS')) unavailable.push({ metric: 'MEDIA_INSIGHTS', reason: (e as Error).message });
      }
      posts.push({
        providerMediaId: m.id,
        mediaType: isReel ? 'REEL' : m.media_type,
        caption: m.caption?.slice(0, 2000),
        permalink: m.permalink,
        thumbnailUrl: m.thumbnail_url,
        publishedAt: m.timestamp ? new Date(m.timestamp) : undefined,
        likes: m.like_count,
        comments: m.comments_count,
        views,
        reach,
        saves,
        shares,
      });
    }

    // Stories are only available while live (24h). Each sync captures current stories; averages
    // are computed by SocialService from stored story history.
    try {
      const stories = await providerFetch(this.url('me/stories', { fields: 'id,media_type,permalink,timestamp' }, accessToken));
      for (const s of (stories.data ?? []) as any[]) {
        let views: number | undefined;
        let reach: number | undefined;
        try {
          const ins = await providerFetch(this.url(`${s.id}/insights`, { metric: 'views,reach' }, accessToken));
          for (const row of ins.data ?? []) {
            const v = row.values?.[0]?.value ?? row.total_value?.value;
            if (row.name === 'views') views = v;
            if (row.name === 'reach') reach = v;
          }
        } catch {
          /* story insights may be unavailable */
        }
        posts.push({ providerMediaId: s.id, mediaType: 'STORY', permalink: s.permalink, publishedAt: s.timestamp ? new Date(s.timestamp) : undefined, views, reach });
      }
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'TOKEN_EXPIRED') throw e;
      unavailable.push({ metric: 'AVG_STORY_VIEWS', reason: (e as Error).message });
    }

    const metrics: FetchResult['metrics'] = [];
    if (profile.followers != null) metrics.push({ type: 'FOLLOWERS', value: profile.followers });
    if (profile.following != null) metrics.push({ type: 'FOLLOWING', value: profile.following });
    if (profile.mediaCount != null) metrics.push({ type: 'MEDIA_COUNT', value: profile.mediaCount });
    const feed = posts.filter((p) => p.mediaType !== 'STORY');
    const reels = feed.filter((p) => p.mediaType === 'REEL');
    const reelAvg = average(reels.map((p) => p.views));
    if (reelAvg) metrics.push({ type: 'AVG_REEL_VIEWS', value: reelAvg.value, sampleSize: reelAvg.n });
    else unavailable.push({ metric: 'AVG_REEL_VIEWS', reason: reels.length ? 'Reel view insights unavailable' : 'No recent Reels' });
    const likes = average(feed.map((p) => p.likes));
    const comments = average(feed.map((p) => p.comments));
    if (likes) metrics.push({ type: 'AVG_LIKES', value: likes.value, sampleSize: likes.n });
    if (comments) metrics.push({ type: 'AVG_COMMENTS', value: comments.value, sampleSize: comments.n });
    if (likes && profile.followers) {
      const er = ((likes.value + (comments?.value ?? 0)) / profile.followers) * 100;
      metrics.push({ type: 'ENGAGEMENT_RATE', value: Math.round(er * 1000) / 1000, sampleSize: likes.n });
    }
    const reachAvg = average(feed.map((p) => p.reach));
    if (reachAvg) metrics.push({ type: 'REACH', value: reachAvg.value, sampleSize: reachAvg.n });

    // Audience geography (requires insights permission and 100+ followers)
    const audience: FetchResult['audience'] = [];
    try {
      const demo = await providerFetch(
        this.url('me/insights', { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: 'country' }, accessToken),
      );
      const results = demo.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const total = results.reduce((a: number, r: any) => a + (r.value ?? 0), 0);
      for (const r of results) if (total > 0) audience.push({ dimension: 'COUNTRY', key: r.dimension_values?.[0], value: r.value / total });
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'TOKEN_EXPIRED') throw e;
      unavailable.push({ metric: 'AUDIENCE_COUNTRY', reason: (e as Error).message });
    }
    return { profile, metrics, posts, audience, unavailable, apiVersion: this.version };
  }
}
