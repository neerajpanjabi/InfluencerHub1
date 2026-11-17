import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, SocialAccount } from '@influencehub/database';
import { env, sandboxAllowed } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { AuditService } from '../../common/services/audit.service';
import { OAuthStateService } from '../auth/oauth-state.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GradingService } from '../grading/grading.service';
import { QueueService, QUEUES } from '../queue/queue.service';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { SandboxSocialAdapter } from './adapters/sandbox.adapter';
import { average, FetchResult, FetchedMetric, ProviderError, SocialPlatform, SocialProviderAdapter, TokenSet } from './adapters/types';

export type ProviderMode = 'live' | 'sandbox';

@Injectable()
export class SocialService implements OnModuleInit {
  private readonly logger = new Logger(SocialService.name);
  private live: Record<SocialPlatform, SocialProviderAdapter> = { INSTAGRAM: new InstagramAdapter(), TIKTOK: new TikTokAdapter() };
  private sandbox: Record<SocialPlatform, SocialProviderAdapter> = { INSTAGRAM: new SandboxSocialAdapter('INSTAGRAM'), TIKTOK: new SandboxSocialAdapter('TIKTOK') };

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly states: OAuthStateService,
    private readonly notifications: NotificationsService,
    private readonly grading: GradingService,
    private readonly queue: QueueService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    this.queue.registerInline(QUEUES.SOCIAL_SYNC, (d) => this.syncAccount(d.socialAccountId, d.trigger ?? 'SCHEDULED'));
    this.queue.registerInline(QUEUES.GRADING, (d) => this.grading.recompute(d.influencerId));
  }

  /** Live adapter when configured; otherwise sandbox when explicitly enabled (never in production). */
  adapterFor(platform: SocialPlatform, mode?: ProviderMode): SocialProviderAdapter {
    if (mode === 'sandbox') {
      if (!this.sandbox[platform].isConfigured()) throw new ServiceUnavailableException({ code: 'SANDBOX_DISABLED' });
      return this.sandbox[platform];
    }
    if (this.live[platform].isConfigured()) return this.live[platform];
    if (this.sandbox[platform].isConfigured()) return this.sandbox[platform];
    throw new ServiceUnavailableException({ code: 'PROVIDER_NOT_CONFIGURED', platform });
  }

  providerStatus() {
    return (['INSTAGRAM', 'TIKTOK'] as const).map((p) => ({
      platform: p,
      live: this.live[p].isConfigured(),
      sandbox: this.sandbox[p].isConfigured(),
    }));
  }

  // ── OAuth connect ───────────────────────────────────────────────
  async startConnect(platform: SocialPlatform, opts: { userId?: string; purpose: 'LINK' | 'LOGIN'; redirectPath?: string; mode?: ProviderMode }) {
    const adapter = this.adapterFor(platform, opts.mode);
    if (opts.purpose === 'LINK') {
      const profile = await this.prisma.influencerProfile.findUnique({ where: { userId: opts.userId! } });
      if (!profile) throw new ForbiddenException({ code: 'INFLUENCER_ONLY' });
    }
    const { state, codeChallenge } = await this.states.create({
      provider: platform,
      purpose: opts.purpose,
      userId: opts.userId,
      userType: 'INFLUENCER',
      redirectPath: opts.redirectPath,
      pkce: adapter.usesPkce(),
    });
    return { url: adapter.authorizeUrl(state, codeChallenge), sandbox: adapter.isSandbox };
  }

  /** OAuth callback: validates state, exchanges the code server-side, stores encrypted tokens. */
  async handleCallback(platform: SocialPlatform, code: string, state: string, mode?: ProviderMode, sessionUserId?: string) {
    const st = await this.states.consume(state, platform);
    // Account-linking callbacks must complete in the same user's session that started them.
    if (st.purpose === 'LINK' && (!sessionUserId || sessionUserId !== st.userId)) throw new ForbiddenException({ code: 'OAUTH_SESSION_MISMATCH' });
    const adapter = this.adapterFor(platform, mode ?? (code.startsWith('sandbox.') ? 'sandbox' : undefined));
    let tokens: TokenSet;
    let data: FetchResult;
    try {
      tokens = await adapter.exchangeCode(code, st.codeVerifier);
      data = await adapter.fetchAll(tokens.accessToken, tokens.providerUserId);
    } catch (e) {
      this.logger.warn(`OAuth exchange failed for ${platform}: ${(e as Error).message}`);
      throw new BadRequestException({ code: e instanceof ProviderError ? `PROVIDER_${e.code}` : 'OAUTH_EXCHANGE_FAILED' });
    }
    if (platform === 'INSTAGRAM' && data.profile.accountType && !['BUSINESS', 'MEDIA_CREATOR'].includes(data.profile.accountType)) {
      // Personal accounts cannot grant insights; connection is still allowed for identity linkage.
      data.unavailable.push({ metric: 'INSIGHTS', reason: 'Instagram professional (Business/Creator) account required for insights' });
    }

    let userId = st.userId;
    let isNewUser = false;
    if (st.purpose === 'LOGIN') {
      const res = await this.auth.findOrCreateSocialInfluencer(platform, data.profile.providerAccountId, data.profile.displayName ?? data.profile.username);
      userId = res.user.id;
      isNewUser = res.isNew;
    }
    const influencer = await this.prisma.influencerProfile.findUnique({ where: { userId: userId! } });
    if (!influencer) throw new ForbiddenException({ code: 'INFLUENCER_ONLY' });

    const existing = await this.prisma.socialAccount.findUnique({ where: { platform_providerAccountId: { platform, providerAccountId: data.profile.providerAccountId } } });
    if (existing && existing.influencerId !== influencer.id && existing.status !== 'DISCONNECTED') {
      await this.audit.log({ actorId: userId }, 'social.connect.conflict', 'SocialAccount', existing.id, undefined, { attemptedBy: influencer.id });
      throw new ConflictException({ code: 'SOCIAL_ACCOUNT_LINKED_ELSEWHERE' });
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const acc = await tx.socialAccount.upsert({
        where: { platform_providerAccountId: { platform, providerAccountId: data.profile.providerAccountId } },
        update: {
          influencerId: influencer.id,
          username: data.profile.username,
          displayName: data.profile.displayName,
          profileImageUrl: data.profile.profileImageUrl,
          biography: data.profile.biography,
          accountType: data.profile.accountType,
          profileUrl: data.profile.profileUrl,
          status: 'CONNECTED',
          isSandbox: adapter.isSandbox,
          apiVersion: data.apiVersion,
          disconnectedAt: null,
          lastError: null,
        },
        create: {
          influencerId: influencer.id,
          platform,
          providerAccountId: data.profile.providerAccountId,
          username: data.profile.username,
          displayName: data.profile.displayName,
          profileImageUrl: data.profile.profileImageUrl,
          biography: data.profile.biography,
          accountType: data.profile.accountType,
          profileUrl: data.profile.profileUrl,
          isSandbox: adapter.isSandbox,
          apiVersion: data.apiVersion,
          isPrimary: !(await tx.socialAccount.count({ where: { influencerId: influencer.id, status: 'CONNECTED' } })),
        },
      });
      await tx.socialOAuthToken.updateMany({ where: { socialAccountId: acc.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.socialOAuthToken.create({ data: this.tokenRow(acc.id, tokens) });
      for (const scope of new Set([...(platform === 'INSTAGRAM' ? InstagramAdapter.SCOPES : TikTokAdapter.SCOPES), ...tokens.scopes])) {
        await tx.socialPermission.upsert({
          where: { socialAccountId_scope: { socialAccountId: acc.id, scope } },
          update: { granted: tokens.scopes.includes(scope), recordedAt: new Date() },
          create: { socialAccountId: acc.id, scope, granted: tokens.scopes.includes(scope) },
        });
      }
      return acc;
    });
    // OAuth proves account control → record SOCIAL_ACCOUNT verification (outside tx to keep tx minimal)
    await this.prisma.verificationRecord.create({
      data: { userId: userId!, type: 'SOCIAL_ACCOUNT', status: 'VERIFIED', referenceId: account.id, data: { platform, username: data.profile.username, method: 'OAUTH', sandbox: adapter.isSandbox }, reviewedAt: new Date() },
    });
    await this.persistFetch(account, data, adapter.isSandbox, 'CONNECT');
    await this.grading.recompute(influencer.id);
    await this.audit.log({ actorId: userId }, 'social.connect', 'SocialAccount', account.id, undefined, { platform, username: data.profile.username, sandbox: adapter.isSandbox });
    await this.notifications.notify(userId!, 'SOCIAL_CONNECTED', { platform, username: data.profile.username }, '/influencer/accounts');
    return { account, userId: userId!, purpose: st.purpose, redirectPath: st.redirectPath, isNewUser, unavailable: data.unavailable };
  }

  private tokenRow(socialAccountId: string, t: TokenSet): Prisma.SocialOAuthTokenUncheckedCreateInput {
    const now = Date.now();
    return {
      socialAccountId,
      accessTokenEnc: this.crypto.encrypt(t.accessToken),
      refreshTokenEnc: t.refreshToken ? this.crypto.encrypt(t.refreshToken) : null,
      tokenType: t.tokenType,
      scopes: t.scopes,
      accessTokenExpiresAt: t.expiresInSeconds ? new Date(now + t.expiresInSeconds * 1000) : null,
      refreshTokenExpiresAt: t.refreshExpiresInSeconds ? new Date(now + t.refreshExpiresInSeconds * 1000) : null,
    };
  }

  // ── Sync ────────────────────────────────────────────────────────
  async requestSync(userId: string, accountId: string) {
    const acc = await this.ownedAccount(userId, accountId);
    if (acc.status !== 'CONNECTED') throw new BadRequestException({ code: 'ACCOUNT_NOT_CONNECTED' });
    if (acc.lastSyncedAt && Date.now() - acc.lastSyncedAt.getTime() < 10 * 60_000) throw new BadRequestException({ code: 'SYNC_TOO_FREQUENT' });
    await this.queue.add(QUEUES.SOCIAL_SYNC, 'sync', { socialAccountId: acc.id, trigger: 'MANUAL' }, { jobId: `manual-${acc.id}-${Math.floor(Date.now() / 600_000)}` });
    return { queued: true };
  }

  async syncAccount(accountId: string, trigger: 'MANUAL' | 'SCHEDULED' | 'CONNECT' = 'SCHEDULED') {
    const acc = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!acc || acc.status !== 'CONNECTED') return { skipped: true };
    if (acc.isSandbox && !sandboxAllowed()) return { skipped: true };
    const log = await this.prisma.socialSyncLog.create({ data: { socialAccountId: acc.id, status: 'RUNNING', trigger } });
    const adapter = acc.isSandbox ? this.sandbox[acc.platform as SocialPlatform] : this.live[acc.platform as SocialPlatform];
    try {
      const token = await this.prisma.socialOAuthToken.findFirst({ where: { socialAccountId: acc.id, revokedAt: null }, orderBy: { createdAt: 'desc' } });
      if (!token) throw new ProviderError('TOKEN_EXPIRED', 'No active token');
      let accessToken = this.crypto.decrypt(token.accessTokenEnc);
      // Refresh proactively when expiring within 7 days (Instagram) / 1 hour (TikTok)
      const threshold = acc.platform === 'INSTAGRAM' ? 7 * 86_400_000 : 3600_000;
      if (token.accessTokenExpiresAt && token.accessTokenExpiresAt.getTime() - Date.now() < threshold) {
        const refreshed = await adapter.refresh({ accessToken, refreshToken: token.refreshTokenEnc ? this.crypto.decrypt(token.refreshTokenEnc) : undefined });
        if (refreshed) {
          await this.prisma.$transaction([
            this.prisma.socialOAuthToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } }),
            this.prisma.socialOAuthToken.create({ data: this.tokenRow(acc.id, { ...refreshed, refreshToken: refreshed.refreshToken ?? (token.refreshTokenEnc ? this.crypto.decrypt(token.refreshTokenEnc) : undefined), scopes: refreshed.scopes.length ? refreshed.scopes : token.scopes }) }),
          ]);
          accessToken = refreshed.accessToken;
        }
      }
      const data = await adapter.fetchAll(accessToken, acc.providerAccountId);
      const written = await this.persistFetch(acc, data, acc.isSandbox, trigger);
      await this.prisma.socialSyncLog.update({
        where: { id: log.id },
        data: { status: data.unavailable.length ? 'PARTIAL' : 'SUCCEEDED', finishedAt: new Date(), metricsWritten: written.metrics, postsWritten: written.posts, errorMessage: data.unavailable.length ? data.unavailable.map((u) => `${u.metric}: ${u.reason}`).join('; ').slice(0, 1000) : null },
      });
      await this.grading.recompute(acc.influencerId);
      return { ok: true, ...written };
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError('PROVIDER_ERROR', (e as Error).message);
      await this.prisma.socialSyncLog.update({ where: { id: log.id }, data: { status: 'FAILED', finishedAt: new Date(), errorCode: pe.code, errorMessage: pe.message.slice(0, 1000) } });
      await this.prisma.socialAccount.update({ where: { id: acc.id }, data: { lastError: `${pe.code}: ${pe.message}`.slice(0, 500), ...(pe.code === 'TOKEN_EXPIRED' ? { status: 'TOKEN_EXPIRED' } : {}) } });
      if (pe.code === 'TOKEN_EXPIRED') {
        // Mark latest API metrics as EXPIRED via grading (handled in buildInput) and notify creator
        const prof = await this.prisma.influencerProfile.findUnique({ where: { id: acc.influencerId } });
        if (prof) await this.notifications.notify(prof.userId, 'SOCIAL_TOKEN_EXPIRED', { platform: acc.platform, username: acc.username }, '/influencer/accounts');
        await this.grading.recompute(acc.influencerId);
        return { ok: false, code: pe.code };
      }
      if (pe.retryable) throw pe; // let the queue retry with backoff
      return { ok: false, code: pe.code };
    }
  }

  /** Append-only persistence: new snapshot rows every sync, posts upserted, audience appended. */
  private async persistFetch(acc: SocialAccount, data: FetchResult, isSandbox: boolean, _trigger: string) {
    const source = isSandbox ? 'SANDBOX' : acc.platform === 'INSTAGRAM' ? 'INSTAGRAM_API' : 'TIKTOK_API';
    const now = new Date();
    let postsWritten = 0;
    for (const p of data.posts) {
      await this.prisma.socialMediaPost.upsert({
        where: { socialAccountId_providerMediaId: { socialAccountId: acc.id, providerMediaId: p.providerMediaId } },
        update: { likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, views: p.views ?? undefined, reach: p.reach ?? undefined, fetchedAt: now, source },
        create: { socialAccountId: acc.id, providerMediaId: p.providerMediaId, mediaType: p.mediaType, caption: p.caption, permalink: p.permalink, thumbnailUrl: p.thumbnailUrl, publishedAt: p.publishedAt, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, views: p.views, reach: p.reach, source, fetchedAt: now },
      });
      postsWritten++;
    }
    const metrics = data.metrics.length ? [...data.metrics] : deriveMetrics(data, acc.platform as SocialPlatform);
    // Story views: average over stories captured in the last 30 days (stories expire after 24h on Instagram)
    if (acc.platform === 'INSTAGRAM' && !metrics.some((m) => m.type === 'AVG_STORY_VIEWS')) {
      const stories = await this.prisma.socialMediaPost.findMany({ where: { socialAccountId: acc.id, mediaType: 'STORY', publishedAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, views: { not: null } }, select: { views: true } });
      const avg = average(stories.map((s) => s.views));
      if (avg) metrics.push({ type: 'AVG_STORY_VIEWS', value: avg.value, sampleSize: avg.n });
    }
    await this.prisma.socialMetricSnapshot.createMany({
      data: metrics.map((m) => ({
        socialAccountId: acc.id,
        platform: acc.platform,
        metricType: m.type,
        value: new Prisma.Decimal(m.value),
        sampleSize: m.sampleSize ?? null,
        source,
        verificationStatus: 'API_VERIFIED' as const,
        apiVersion: data.apiVersion,
        collectedAt: now,
      })),
    });
    if (data.audience.length) {
      await this.prisma.audienceInsight.createMany({
        data: data.audience.filter((a) => a.key).map((a) => ({ socialAccountId: acc.id, dimension: a.dimension, key: a.key, value: new Prisma.Decimal(Math.round(a.value * 10000) / 10000), source, verificationStatus: 'API_VERIFIED' as const, collectedAt: now })),
      });
    }
    await this.prisma.socialAccount.update({
      where: { id: acc.id },
      data: { lastSyncedAt: now, nextSyncAt: new Date(now.getTime() + 24 * 3600_000), lastError: null, username: data.profile.username ?? acc.username, profileImageUrl: data.profile.profileImageUrl ?? acc.profileImageUrl },
    });
    return { metrics: metrics.length, posts: postsWritten };
  }

  // ── Disconnect / token revocation ───────────────────────────────
  async disconnect(userId: string, accountId: string, actorIsAdmin = false) {
    const acc = actorIsAdmin ? await this.prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } }) : await this.ownedAccount(userId, accountId);
    const tokens = await this.prisma.socialOAuthToken.findMany({ where: { socialAccountId: acc.id, revokedAt: null } });
    const adapter = acc.isSandbox ? this.sandbox[acc.platform as SocialPlatform] : this.live[acc.platform as SocialPlatform];
    for (const t of tokens) {
      try {
        await adapter.revoke(this.crypto.decrypt(t.accessTokenEnc));
      } catch (e) {
        this.logger.warn(`Token revoke failed for ${acc.id}: ${(e as Error).message}`);
      }
    }
    await this.prisma.$transaction([
      // Tokens are destroyed (ciphertext overwritten) not merely flagged.
      this.prisma.socialOAuthToken.updateMany({ where: { socialAccountId: acc.id }, data: { revokedAt: new Date(), accessTokenEnc: 'revoked', refreshTokenEnc: null } }),
      this.prisma.socialAccount.update({ where: { id: acc.id }, data: { status: 'DISCONNECTED', disconnectedAt: new Date(), isPrimary: false } }),
    ]);
    await this.grading.recompute(acc.influencerId);
    await this.audit.log({ actorId: userId }, 'social.disconnect', 'SocialAccount', acc.id, undefined, { platform: acc.platform });
    const prof = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { id: acc.influencerId } });
    await this.notifications.notify(prof.userId, 'SOCIAL_DISCONNECTED', { platform: acc.platform, username: acc.username }, '/influencer/accounts');
    return { ok: true };
  }

  private async ownedAccount(userId: string, accountId: string) {
    const acc = await this.prisma.socialAccount.findFirst({ where: { id: accountId, influencer: { userId } } });
    if (!acc) throw new NotFoundException({ code: 'NOT_FOUND' });
    return acc;
  }

  // ── Creator-facing reads ────────────────────────────────────────
  async myAccounts(userId: string) {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { influencer: { userId } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, platform: true, username: true, displayName: true, profileImageUrl: true, accountType: true, profileUrl: true, status: true, isSandbox: true, isPrimary: true,
        connectedAt: true, lastSyncedAt: true, nextSyncAt: true, lastError: true, apiVersion: true,
        permissions: { select: { scope: true, granted: true } },
        syncLogs: { orderBy: { startedAt: 'desc' }, take: 5, select: { status: true, trigger: true, startedAt: true, finishedAt: true, errorCode: true, errorMessage: true, metricsWritten: true } },
      },
    });
    const result = [];
    for (const a of accounts) {
      const latest = await this.latestMetrics(a.id);
      result.push({ ...a, metrics: latest });
    }
    return { accounts: result, providers: this.providerStatus() };
  }

  async latestMetrics(accountId: string) {
    return this.prisma.$queryRaw<Array<{ metricType: string; value: Prisma.Decimal; verificationStatus: string; source: string; collectedAt: Date; updatedAt: Date; sampleSize: number | null; apiVersion: string | null; platform: string }>>`
      SELECT DISTINCT ON ("metricType") "metricType", value, "verificationStatus", source, "collectedAt", "updatedAt", "sampleSize", "apiVersion", platform
      FROM social_metric_snapshots WHERE "socialAccountId" = ${accountId}::uuid ORDER BY "metricType", "collectedAt" DESC`;
  }

  async metricHistory(userId: string, accountId: string, metricType: string) {
    await this.ownedAccount(userId, accountId);
    return this.prisma.socialMetricSnapshot.findMany({ where: { socialAccountId: accountId, metricType: metricType as any }, orderBy: { collectedAt: 'asc' }, take: 120, select: { value: true, collectedAt: true, verificationStatus: true, source: true } });
  }

  /** Manually submitted metrics are clearly labelled and await admin verification. */
  async submitManualMetric(userId: string, dto: { socialAccountId: string; metricType: string; value: number; sampleSize?: number; evidenceAttachmentId?: string }) {
    const acc = await this.ownedAccount(userId, dto.socialAccountId);
    const snap = await this.prisma.socialMetricSnapshot.create({
      data: { socialAccountId: acc.id, platform: acc.platform, metricType: dto.metricType as any, value: new Prisma.Decimal(dto.value), sampleSize: dto.sampleSize, source: 'MANUAL', verificationStatus: 'PENDING_VERIFICATION', collectedAt: new Date() },
    });
    await this.prisma.verificationRecord.create({ data: { userId, type: 'SOCIAL_ACCOUNT', status: 'PENDING', referenceId: snap.id, documentIds: dto.evidenceAttachmentId ? [dto.evidenceAttachmentId] : [], data: { kind: 'MANUAL_METRIC', metricType: dto.metricType, value: dto.value, socialAccountId: acc.id } } });
    await this.grading.recompute(acc.influencerId);
    return snap;
  }

  async enqueueDueSyncs() {
    const due = await this.prisma.socialAccount.findMany({ where: { status: 'CONNECTED', OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }] }, select: { id: true }, take: 500 });
    for (const a of due) await this.queue.add(QUEUES.SOCIAL_SYNC, 'sync', { socialAccountId: a.id, trigger: 'SCHEDULED' }, { jobId: `sched-${a.id}-${new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, '')}` });
    return due.length;
  }

  sandboxEnabled() {
    return env().SOCIAL_SANDBOX_ENABLED && sandboxAllowed();
  }
}

/** Derive standard metrics from profile + posts (used for sandbox; live adapters compute their own). */
export function deriveMetrics(data: FetchResult, platform: SocialPlatform): FetchedMetric[] {
  const out: FetchedMetric[] = [];
  const p = data.profile;
  if (p.followers != null) out.push({ type: 'FOLLOWERS', value: p.followers });
  if (p.following != null) out.push({ type: 'FOLLOWING', value: p.following });
  if (p.mediaCount != null) out.push({ type: platform === 'TIKTOK' ? 'VIDEO_COUNT' : 'MEDIA_COUNT', value: p.mediaCount });
  const feed = data.posts.filter((x) => x.mediaType !== 'STORY');
  if (platform === 'INSTAGRAM') {
    const reels = average(feed.filter((x) => x.mediaType === 'REEL').map((x) => x.views));
    if (reels) out.push({ type: 'AVG_REEL_VIEWS', value: reels.value, sampleSize: reels.n });
    const stories = average(data.posts.filter((x) => x.mediaType === 'STORY').map((x) => x.views));
    if (stories) out.push({ type: 'AVG_STORY_VIEWS', value: stories.value, sampleSize: stories.n });
    const likes = average(feed.map((x) => x.likes));
    const comments = average(feed.map((x) => x.comments));
    if (likes && p.followers) out.push({ type: 'ENGAGEMENT_RATE', value: Math.round((((likes.value + (comments?.value ?? 0)) / p.followers) * 100) * 1000) / 1000, sampleSize: likes.n });
  } else {
    const views = average(feed.map((x) => x.views));
    if (views) out.push({ type: 'AVG_VIDEO_VIEWS', value: views.value, sampleSize: views.n });
    const totalViews = feed.reduce((a, x) => a + (x.views ?? 0), 0);
    if (totalViews > 0) out.push({ type: 'ENGAGEMENT_RATE', value: Math.round((feed.reduce((a, x) => a + (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0), 0) / totalViews) * 100 * 1000) / 1000, sampleSize: feed.length });
  }
  return out;
}
