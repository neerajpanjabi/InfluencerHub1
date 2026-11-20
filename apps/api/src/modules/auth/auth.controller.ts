import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { businessRegistrationSchema, influencerRegistrationSchema, loginSchema, passwordSchema, emailSchema, type BusinessRegistration, type InfluencerRegistration } from '@influencehub/shared';
import { env } from '../../config/env';
import { AllowPending2fa, AuthUser, CurrentUser, Public, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { AuthService } from './auth.service';
import { OAuthStateService } from './oauth-state.service';

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly states: OAuthStateService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/business')
  async registerBusiness(@Body(zbody(businessRegistrationSchema)) dto: BusinessRegistration, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.registerBusiness(dto, meta(req));
    await this.auth.createSession(user, res, meta(req));
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register/influencer')
  async registerInfluencer(@Body(zbody(influencerRegistrationSchema)) dto: InfluencerRegistration, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.registerInfluencer(dto, meta(req));
    await this.auth.createSession(user, res, meta(req));
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body(zbody(loginSchema)) dto: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tfaPassed } = await this.auth.login(dto.email, dto.password, dto.totp, meta(req));
    await this.auth.createSession(user, res, meta(req), tfaPassed);
    return { ...(await this.auth.me(user.id)), requiresTwoFactorSetup: user.type === 'ADMIN' && !user.twoFactorEnabled };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser | undefined, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user?.sessionId, res);
    return { ok: true };
  }

  @AllowPending2fa()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id).then((u) => ({ ...u, twoFactorPassed: user.tfa }));
  }

  @Post('locale')
  async locale(@CurrentUser() user: AuthUser, @Body(zbody(z.object({ locale: z.enum(['en', 'ar']) }))) b: { locale: 'en' | 'ar' }) {
    await this.auth.setLocale(user.id, b.locale);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body(zbody(z.object({ token: z.string().min(10).max(200) }))) b: { token: string }) {
    return this.auth.verifyEmail(b.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('verify-email/resend')
  async resend(@CurrentUser() user: AuthUser) {
    const u = await this.auth.me(user.id);
    if (!u.emailVerifiedAt) await this.auth.sendEmailVerification({ id: u.id, email: u.email, locale: u.locale });
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/forgot')
  forgot(@Body(zbody(z.object({ email: emailSchema }))) b: { email: string }) {
    return this.auth.requestPasswordReset(b.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body(zbody(z.object({ token: z.string().min(10).max(200), password: passwordSchema }))) b: { token: string; password: string }) {
    return this.auth.resetPassword(b.token, b.password);
  }

  @Post('password/change')
  async change(@CurrentUser() user: AuthUser, @Body(zbody(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }))) b: { currentPassword: string; newPassword: string }) {
    await this.auth.changePassword(user.id, b.currentPassword, b.newPassword, user.sessionId);
    return { ok: true };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('phone/send-otp')
  sendOtp(@CurrentUser() user: AuthUser) {
    return this.auth.sendPhoneOtp(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/verify')
  verifyOtp(@CurrentUser() user: AuthUser, @Body(zbody(z.object({ code: z.string().regex(/^\d{6}$/) }))) b: { code: string }) {
    return this.auth.verifyPhoneOtp(user.id, b.code);
  }

  // ── Admin 2FA
  @UserTypes('ADMIN')
  @AllowPending2fa()
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.auth.setupTotp(user.id);
  }

  @UserTypes('ADMIN')
  @AllowPending2fa()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body(zbody(z.object({ code: z.string().regex(/^\d{6}$/) }))) b: { code: string }, @Res({ passthrough: true }) res: Response) {
    return this.auth.enableTotp(user.id, user.sessionId, b.code, res);
  }

  // ── Google OAuth (business login)
  @Public()
  @Get('providers')
  providers() {
    return {
      google: this.auth.googleConfigured(),
      instagram: !!(env().INSTAGRAM_APP_ID && env().INSTAGRAM_APP_SECRET),
      tiktok: !!(env().TIKTOK_CLIENT_KEY && env().TIKTOK_CLIENT_SECRET),
      socialSandbox: env().SOCIAL_SANDBOX_ENABLED && env().APP_ENV !== 'production',
    };
  }

  @Public()
  @Get('google/start')
  async googleStart(@Query('redirect') redirect: string | undefined, @Res() res: Response) {
    if (!this.auth.googleConfigured()) throw new ServiceUnavailableException({ code: 'PROVIDER_NOT_CONFIGURED' });
    const { state, codeChallenge } = await this.states.create({ provider: 'GOOGLE', purpose: 'LOGIN', userType: 'BUSINESS', redirectPath: redirect, pkce: true });
    res.redirect(this.auth.googleAuthUrl(state, codeChallenge!));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string | undefined, @Req() req: Request, @Res() res: Response) {
    const web = env().WEB_ORIGIN;
    if (error) return res.redirect(`${web}/en/login?error=oauth_denied`);
    try {
      const st = await this.states.consume(state, 'GOOGLE');
      const profile = await this.auth.googleExchange(code, st.codeVerifier!);
      const { user, isNew } = await this.auth.loginWithGoogle(profile);
      if (user.status !== 'ACTIVE') return res.redirect(`${web}/en/login?error=account_inactive`);
      await this.auth.createSession(user, res, meta(req));
      return res.redirect(`${web}/${user.locale}${isNew ? '/business/onboarding' : st.redirectPath ?? '/business'}`);
    } catch (e) {
      const code = (e as any)?.response?.code ?? 'oauth_failed';
      return res.redirect(`${web}/en/login?error=${encodeURIComponent(String(code).toLowerCase())}`);
    }
  }
}
