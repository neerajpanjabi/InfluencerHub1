import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { manualMetricSchema } from '@influencehub/shared';
import { env } from '../../config/env';
import { AuthUser, CurrentUser, Public, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { escapeHtml } from '../notifications/templates';
import { AuthService } from '../auth/auth.service';
import { SocialService } from './social.service';
import { PrismaService } from '../../common/services/prisma.service';

const platformParam = (p: string) => {
  const up = p.toUpperCase();
  if (up !== 'INSTAGRAM' && up !== 'TIKTOK') throw new NotFoundException();
  return up as 'INSTAGRAM' | 'TIKTOK';
};

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService, private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @UserTypes('INFLUENCER')
  @Get('accounts')
  accounts(@CurrentUser() u: AuthUser) {
    return this.social.myAccounts(u.id);
  }

  @UserTypes('INFLUENCER')
  @Post(':platform/connect')
  connect(@CurrentUser() u: AuthUser, @Param('platform') platform: string, @Body(zbody(z.object({ mode: z.enum(['live', 'sandbox']).optional() }))) b: { mode?: 'live' | 'sandbox' }) {
    return this.social.startConnect(platformParam(platform), { userId: u.id, purpose: 'LINK', mode: b.mode, redirectPath: '/influencer/accounts' });
  }

  /** Influencer sign-in with Instagram / TikTok (creates the account on first login). */
  @Public()
  @Get(':platform/login')
  async login(@Param('platform') platform: string, @Query('mode') mode: string | undefined, @Res() res: Response) {
    const r = await this.social.startConnect(platformParam(platform), { purpose: 'LOGIN', mode: mode === 'sandbox' ? 'sandbox' : undefined, redirectPath: '/influencer' });
    res.redirect(r.url);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':platform/callback')
  async callback(@Param('platform') platform: string, @Query() q: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    const web = env().WEB_ORIGIN;
    const locale = (req as any).user?.locale ?? 'en';
    if (q.error) return res.redirect(`${web}/${locale}/influencer/accounts?error=${encodeURIComponent(q.error === 'access_denied' ? 'oauth_denied' : 'oauth_failed')}`);
    try {
      // Sandbox consent page posts back a username; convert it to a sandbox authorization code.
      const code = q.sandbox === '1' && this.social.sandboxEnabled() && /^[a-z0-9._]{2,30}$/.test(q.username ?? '') ? `sandbox.${q.username}` : q.code;
      if (!code || !q.state) throw new BadRequestException({ code: 'OAUTH_STATE_INVALID' });
      const result = await this.social.handleCallback(platformParam(platform), code, q.state, code.startsWith('sandbox.') ? 'sandbox' : undefined, (req as any).user?.id);
      if (result.purpose === 'LOGIN') {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
        if (user.status !== 'ACTIVE') return res.redirect(`${web}/en/login?error=account_inactive`);
        await this.auth.createSession(user, res, { ip: req.ip, userAgent: req.headers['user-agent'] });
        return res.redirect(`${web}/${user.locale}${result.isNewUser ? '/influencer/onboarding' : '/influencer'}`);
      }
      return res.redirect(`${web}/${locale}/influencer/accounts?connected=${platform.toLowerCase()}`);
    } catch (e) {
      const code = String((e as any)?.response?.code ?? 'oauth_failed').toLowerCase();
      return res.redirect(`${web}/${locale}/influencer/accounts?error=${encodeURIComponent(code)}`);
    }
  }

  /**
   * SANDBOX consent screen — simulates the provider's authorization page for development and
   * automated tests. Returns 404 unless SOCIAL_SANDBOX_ENABLED=true outside production.
   */
  @Public()
  @Get('sandbox/authorize')
  sandboxAuthorize(@Query('state') state: string, @Query('platform') platform: string, @Res() res: Response) {
    if (!this.social.sandboxEnabled()) throw new NotFoundException();
    const p = platformParam(platform ?? '');
    const action = `${env().API_PUBLIC_URL}/social/${p.toLowerCase()}/callback`;
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' " + new URL(env().API_PUBLIC_URL).origin);
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox ${p} authorization</title>
<style>body{font-family:system-ui;background:#f6f5f2;color:#0b1b33;display:grid;place-items:center;min-height:100vh;margin:0}form{background:#fff;padding:32px;border-radius:8px;max-width:380px;box-shadow:0 8px 30px rgba(11,27,51,.08);border-top:4px solid #c8a96a}
.b{background:#fff4d6;color:#7a5b12;padding:6px 10px;border-radius:4px;font-size:12px;font-weight:600;display:inline-block}input{width:100%;padding:10px;margin:8px 0 16px;border:1px solid #d6d3cc;border-radius:6px;box-sizing:border-box}button{background:#0b1b33;color:#fff;border:0;padding:12px 16px;border-radius:6px;width:100%;cursor:pointer}</style></head>
<body><form method="get" action="${escapeHtml(action)}"><span class="b">SANDBOX — simulated ${p} login</span><h2>Authorize InfluenceHub</h2>
<p>This simulates the official ${p} consent screen. Data returned is synthetic and labelled “Sandbox”.</p>
<input type="hidden" name="state" value="${escapeHtml(state ?? '')}"><label>Sandbox username<input name="username" required pattern="[a-z0-9._]{2,30}" value="sandbox.creator"></label>
<button type="submit" name="sandbox" value="1">Allow access</button></form></body></html>`);
  }

  @UserTypes('INFLUENCER')
  @Post('accounts/:id/sync')
  sync(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.social.requestSync(u.id, id);
  }

  @UserTypes('INFLUENCER')
  @Delete('accounts/:id')
  disconnect(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.social.disconnect(u.id, id);
  }

  @UserTypes('INFLUENCER')
  @Get('accounts/:id/history')
  history(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('metric') metric = 'FOLLOWERS') {
    return this.social.metricHistory(u.id, id, metric);
  }

  @UserTypes('INFLUENCER')
  @Post('metrics/manual')
  manual(@CurrentUser() u: AuthUser, @Body(zbody(manualMetricSchema)) dto: z.infer<typeof manualMetricSchema>) {
    return this.social.submitManualMetric(u.id, dto);
  }
}
