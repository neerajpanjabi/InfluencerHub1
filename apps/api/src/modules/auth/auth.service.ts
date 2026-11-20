import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import type { Response, Request } from 'express';
import { Prisma, User, UserType } from '@influencehub/database';
import { legalConsentVersion, REQUIRED_LEGAL_DOCUMENTS, type BusinessRegistration, type InfluencerRegistration } from '@influencehub/shared';
import { env, isProd } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { AuditService } from '../../common/services/audit.service';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../../common/guards/auth.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$Jr8jtUJ7Gk3Mf2E1E6p0B0uX3XxwX4ZbX0w8f7Nq2wM';

/** Consent records for the legal documents a user type accepts at sign-up (type, versioned key). */
export function legalConsents(userType: 'BUSINESS' | 'INFLUENCER', ip?: string) {
  return REQUIRED_LEGAL_DOCUMENTS[userType].map((key) => ({
    type: key === 'privacy' ? ('PRIVACY' as const) : ('TERMS' as const),
    version: legalConsentVersion(key),
    granted: true,
    ipAddress: ip ?? null,
  }));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50) || 'creator';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  // ── Registration ───────────────────────────────────────────────
  async registerBusiness(dto: BusinessRegistration, meta: { ip?: string }) {
    await this.ensureEmailFree(dto.email);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'BUSINESS' } });
    const cats = await this.prisma.category.count({ where: { id: { in: dto.categoryIds }, isActive: true } });
    if (cats !== dto.categoryIds.length) throw new BadRequestException({ code: 'INVALID_CATEGORY' });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        phone: dto.phone,
        type: 'BUSINESS',
        locale: dto.locale,
        roles: { create: { roleId: role.id } },
        preferences: { create: { locale: dto.locale } },
        consentRecords: { create: legalConsents('BUSINESS', meta.ip) },
        businessProfile: {
          create: {
            businessName: dto.businessName,
            contactPerson: dto.contactPerson,
            businessEmail: dto.email,
            phone: dto.phone,
            emirate: dto.emirate,
            city: dto.city,
            website: dto.website || null,
            description: dto.description,
            tradeLicenceNumber: dto.tradeLicenceNumber,
            categories: { create: dto.categoryIds.map((categoryId) => ({ categoryId })) },
          },
        },
      },
    });
    await this.audit.log({ actorId: user.id, ip: meta.ip }, 'auth.register.business', 'User', user.id);
    await this.sendEmailVerification(user);
    await this.notifications.notify(user.id, 'WELCOME');
    return user;
  }

  async registerInfluencer(dto: InfluencerRegistration, meta: { ip?: string }) {
    await this.ensureEmailFree(dto.email);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'INFLUENCER' } });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        phone: dto.phone,
        type: 'INFLUENCER',
        locale: dto.locale,
        roles: { create: { roleId: role.id } },
        preferences: { create: { locale: dto.locale } },
        consentRecords: { create: legalConsents('INFLUENCER', meta.ip) },
        influencerProfile: {
          create: {
            slug: await this.uniqueSlug(dto.displayName),
            fullName: dto.fullName,
            displayName: dto.displayName,
            phone: dto.phone,
            emirate: dto.emirate,
            city: dto.city,
            languages: [dto.locale],
            searchText: `${dto.displayName} ${dto.fullName} ${dto.city}`.toLowerCase(),
          },
        },
      },
    });
    await this.audit.log({ actorId: user.id, ip: meta.ip }, 'auth.register.influencer', 'User', user.id);
    await this.sendEmailVerification(user);
    await this.notifications.notify(user.id, 'WELCOME');
    return user;
  }

  async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 20; i++) {
      const slug = i === 0 ? base : `${base}-${CryptoService.randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      if (!(await this.prisma.influencerProfile.findUnique({ where: { slug } }))) return slug;
    }
    return `${base}-${Date.now()}`;
  }

  private async ensureEmailFree(email: string) {
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException({ code: 'EMAIL_IN_USE' });
  }

  // ── Login / sessions ───────────────────────────────────────────
  async login(email: string, password: string, totp: string | undefined, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash || user.status === 'DELETED') {
      await argon2.verify(DUMMY_HASH, password).catch(() => false); // equalise timing
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpException({ code: 'ACCOUNT_LOCKED' }, HttpStatus.TOO_MANY_REQUESTS);
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      await this.audit.log({ actorId: user.id, ip: meta.ip, userAgent: meta.userAgent }, 'auth.login.failed', 'User', user.id);
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (user.status === 'SUSPENDED') throw new ForbiddenException({ code: 'ACCOUNT_SUSPENDED' });

    let tfaPassed = false;
    if (user.type === 'ADMIN' && user.twoFactorEnabled) {
      if (!totp) throw new UnauthorizedException({ code: 'TOTP_REQUIRED' });
      if (!this.verifyTotp(user, totp)) throw new UnauthorizedException({ code: 'TOTP_INVALID' });
      tfaPassed = true;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, ip: meta.ip, userAgent: meta.userAgent }, user.type === 'ADMIN' ? 'auth.admin.login' : 'auth.login', 'User', user.id);
    return { user, tfaPassed };
  }

  async createSession(user: User, res: Response, meta: { ip?: string; userAgent?: string }, tfaPassed = false) {
    const refresh = CryptoService.randomToken(48);
    const isAdmin = user.type === 'ADMIN';
    const ttlMs = isAdmin ? env().ADMIN_SESSION_TTL_HOURS * 3600_000 : env().REFRESH_TOKEN_TTL_DAYS * 86_400_000;
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: CryptoService.sha256(refresh),
        userAgent: meta.userAgent?.slice(0, 300),
        ipAddress: meta.ip,
        isAdminSession: isAdmin,
        twoFactorPassed: tfaPassed,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    this.setCookies(res, user, session.id, refresh, tfaPassed, ttlMs);
    return session;
  }

  private signAccess(user: Pick<User, 'id' | 'type' | 'locale'>, sessionId: string, tfa: boolean) {
    return jwt.sign({ sub: user.id, typ: user.type, sid: sessionId, tfa, loc: user.locale }, env().JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: env().ACCESS_TOKEN_TTL_SECONDS,
      audience: 'influencehub-api',
      issuer: 'influencehub',
    });
  }

  private cookieBase() {
    return { httpOnly: true, secure: isProd() || env().APP_ENV === 'staging', sameSite: 'lax' as const, domain: env().COOKIE_DOMAIN || undefined };
  }

  private setCookies(res: Response, user: Pick<User, 'id' | 'type' | 'locale'>, sessionId: string, refresh: string, tfa: boolean, refreshTtlMs: number) {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, this.signAccess(user, sessionId, tfa), { ...base, path: '/', maxAge: env().ACCESS_TOKEN_TTL_SECONDS * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, path: '/api/v1/auth', maxAge: refreshTtlMs });
    res.cookie(CSRF_COOKIE, CryptoService.randomToken(24), { ...base, httpOnly: false, path: '/', maxAge: refreshTtlMs });
  }

  clearCookies(res: Response) {
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
    res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false, path: '/' });
  }

  /** Refresh-token rotation. Reuse of a rotated token revokes all of the user's sessions. */
  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException({ code: 'NO_REFRESH_TOKEN' });
    const hash = CryptoService.sha256(token);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session) throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN' });
    if (session.revokedAt) {
      await this.prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorId: session.userId, ip: req.ip }, 'auth.refresh.reuse_detected', 'Session', session.id);
      this.clearCookies(res);
      throw new UnauthorizedException({ code: 'SESSION_REVOKED' });
    }
    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      this.clearCookies(res);
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED' });
    }
    const next = CryptoService.randomToken(48);
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.session.create({
        data: { id: undefined, userId: session.userId, refreshTokenHash: CryptoService.sha256(next), userAgent: session.userAgent, ipAddress: req.ip, isAdminSession: session.isAdminSession, twoFactorPassed: session.twoFactorPassed, expiresAt: session.expiresAt },
      }),
    ]);
    const created = await this.prisma.session.findUniqueOrThrow({ where: { refreshTokenHash: CryptoService.sha256(next) } });
    this.setCookies(res, session.user, created.id, next, session.twoFactorPassed, session.expiresAt.getTime() - Date.now());
    return { ok: true };
  }

  async logout(sessionId: string | undefined, res: Response) {
    if (sessionId) await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    this.clearCookies(res);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true, type: true, locale: true, twoFactorEnabled: true, createdAt: true,
        roles: { select: { role: { select: { key: true } } } },
        businessProfile: { select: { id: true, businessName: true, logoUrl: true, onboardingCompleted: true, verificationStatus: true } },
        influencerProfile: { select: { id: true, slug: true, displayName: true, profileImageUrl: true, onboardingCompleted: true, isPublic: true, currentGrade: true } },
      },
    });
    return { ...user, roles: user.roles.map((r) => r.role.key) };
  }

  async setLocale(userId: string, locale: 'en' | 'ar') {
    await this.prisma.user.update({ where: { id: userId }, data: { locale, preferences: { upsert: { create: { locale }, update: { locale } } } } });
  }

  // ── Email verification & password reset ───────────────────────
  private async issueToken(userId: string, purpose: string, ttlMinutes: number, raw?: string) {
    const token = raw ?? CryptoService.randomToken(32);
    await this.prisma.oneTimeToken.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.prisma.oneTimeToken.create({ data: { userId, purpose, tokenHash: CryptoService.sha256(`${purpose}:${token}`), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
    return token;
  }

  private async consumeToken(purpose: string, token: string) {
    const row = await this.prisma.oneTimeToken.findUnique({ where: { tokenHash: CryptoService.sha256(`${purpose}:${token}`) } });
    if (!row || row.purpose !== purpose || row.consumedAt || row.expiresAt < new Date()) throw new BadRequestException({ code: 'TOKEN_INVALID' });
    const upd = await this.prisma.oneTimeToken.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (upd.count !== 1) throw new BadRequestException({ code: 'TOKEN_INVALID' });
    return row;
  }

  async sendEmailVerification(user: Pick<User, 'id' | 'email' | 'locale'>) {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFY', 60 * 24);
    await this.email.queue(user.email, user.locale, 'EMAIL_VERIFY', { link: `${env().WEB_ORIGIN}/${user.locale}/verify-email?token=${token}` });
    return token;
  }

  async verifyEmail(token: string) {
    const row = await this.consumeToken('EMAIL_VERIFY', token);
    await this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    await this.prisma.verificationRecord.create({ data: { userId: row.userId, type: 'EMAIL', status: 'VERIFIED', reviewedAt: new Date() } });
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always respond identically to avoid account enumeration.
    if (user && user.status !== 'DELETED') {
      const token = await this.issueToken(user.id, 'PASSWORD_RESET', 30);
      await this.email.queue(user.email, user.locale, 'PASSWORD_RESET', { link: `${env().WEB_ORIGIN}/${user.locale}/reset-password?token=${token}` });
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const row = await this.consumeToken('PASSWORD_RESET', token);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: row.userId }, 'auth.password.reset', 'User', row.userId);
    return { ok: true };
  }

  async changePassword(userId: string, current: string, next: string, keepSessionId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, current))) throw new BadRequestException({ code: 'INVALID_CREDENTIALS' });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(next, { type: argon2.argon2id }) } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null, id: { not: keepSessionId } }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: userId }, 'auth.password.change', 'User', userId);
  }

  // ── Phone OTP ──────────────────────────────────────────────────
  async sendPhoneOtp(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.phone) throw new BadRequestException({ code: 'NO_PHONE' });
    const recent = await this.prisma.oneTimeToken.count({ where: { userId, purpose: 'PHONE_OTP', createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) throw new HttpException({ code: 'TOO_MANY_OTP_REQUESTS' }, HttpStatus.TOO_MANY_REQUESTS);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.issueToken(userId, 'PHONE_OTP', 10, code);
    await this.notifications.sms(user.phone, user.locale, 'PHONE_OTP', { code });
    return { sent: true, ...(env().APP_ENV === 'test' ? { testCode: code } : {}) };
  }

  async verifyPhoneOtp(userId: string, code: string) {
    const pending = await this.prisma.oneTimeToken.findFirst({ where: { userId, purpose: 'PHONE_OTP', consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!pending || pending.attempts >= 5) throw new BadRequestException({ code: 'TOKEN_INVALID' });
    if (pending.tokenHash !== CryptoService.sha256(`PHONE_OTP:${code}`)) {
      await this.prisma.oneTimeToken.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException({ code: 'TOKEN_INVALID' });
    }
    await this.prisma.oneTimeToken.update({ where: { id: pending.id }, data: { consumedAt: new Date() } });
    await this.prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
    await this.prisma.verificationRecord.create({ data: { userId, type: 'PHONE', status: 'VERIFIED', reviewedAt: new Date() } });
    return { ok: true };
  }

  // ── Admin two-factor (TOTP) ────────────────────────────────────
  private verifyTotp(user: Pick<User, 'twoFactorSecret'>, code: string) {
    if (!user.twoFactorSecret) return false;
    authenticator.options = { window: 1 };
    return authenticator.verify({ token: code, secret: this.crypto.decrypt(user.twoFactorSecret) });
  }

  async setupTotp(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) throw new BadRequestException({ code: 'TOTP_ALREADY_ENABLED' });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: this.crypto.encrypt(secret) } });
    return { secret, otpauthUrl: authenticator.keyuri(user.email, 'InfluenceHub Admin', secret) };
  }

  async enableTotp(userId: string, sessionId: string, code: string, res: Response) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!this.verifyTotp(user, code)) throw new BadRequestException({ code: 'TOTP_INVALID' });
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: userId }, 'auth.admin.2fa_enabled', 'User', userId);
    // Start a fresh, fully-authenticated session
    await this.createSession(user, res, {}, true);
    return { ok: true };
  }

  // ── Google OAuth (OIDC authorization code + PKCE) ──────────────
  googleConfigured() {
    return !!(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET);
  }

  googleAuthUrl(state: string, codeChallenge: string) {
    const p = new URLSearchParams({
      client_id: env().GOOGLE_CLIENT_ID!,
      redirect_uri: `${env().API_PUBLIC_URL}/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }

  async googleExchange(code: string, codeVerifier: string) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env().GOOGLE_CLIENT_ID!,
        client_secret: env().GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${env().API_PUBLIC_URL}/auth/google/callback`,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    if (!r.ok) throw new BadRequestException({ code: 'OAUTH_EXCHANGE_FAILED' });
    const tokens = (await r.json()) as { access_token: string };
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    if (!info.ok) throw new BadRequestException({ code: 'OAUTH_PROFILE_FAILED' });
    const profile = (await info.json()) as { sub: string; email: string; email_verified: boolean; name?: string };
    if (!profile.email_verified) throw new BadRequestException({ code: 'GOOGLE_EMAIL_UNVERIFIED' });
    return profile;
  }

  /**
   * Google login is offered to BUSINESS users. Existing accounts are linked only when the Google
   * email is verified and matches; new accounts start business onboarding.
   */
  async loginWithGoogle(profile: { sub: string; email: string; name?: string }) {
    const linked = await this.prisma.authAccount.findUnique({ where: { provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: profile.sub } }, include: { user: true } });
    if (linked) return { user: linked.user, isNew: false };
    const email = profile.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.type !== 'BUSINESS') throw new ForbiddenException({ code: 'GOOGLE_LOGIN_BUSINESS_ONLY' });
      await this.prisma.authAccount.create({ data: { userId: existing.id, provider: 'GOOGLE', providerAccountId: profile.sub } });
      return { user: existing, isNew: false };
    }
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'BUSINESS' } });
    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        type: 'BUSINESS',
        roles: { create: { roleId: role.id } },
        preferences: { create: {} },
        authAccounts: { create: { provider: 'GOOGLE', providerAccountId: profile.sub } },
        consentRecords: { create: legalConsents('BUSINESS') },
        businessProfile: { create: { businessName: profile.name ?? email.split('@')[0], contactPerson: profile.name ?? '', businessEmail: email } },
      },
    });
    return { user, isNew: true };
  }

  /** Social-login helper used by Instagram/TikTok influencer sign-in. */
  async findOrCreateSocialInfluencer(provider: 'INSTAGRAM' | 'TIKTOK', providerAccountId: string, displayName: string) {
    const linked = await this.prisma.authAccount.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } }, include: { user: true } });
    if (linked) return { user: linked.user, isNew: false };
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'INFLUENCER' } });
    // Social sign-in does not provide an email: a placeholder is stored until the creator adds one.
    const placeholder = `${provider.toLowerCase()}-${CryptoService.sha256(providerAccountId).slice(0, 16)}@users.influencehub.invalid`;
    const user = await this.prisma.user.create({
      data: {
        email: placeholder,
        type: 'INFLUENCER',
        roles: { create: { roleId: role.id } },
        preferences: { create: {} },
        authAccounts: { create: { provider, providerAccountId } },
        consentRecords: { create: legalConsents('INFLUENCER') },
        influencerProfile: { create: { slug: await this.uniqueSlug(displayName), fullName: displayName, displayName } },
      },
    });
    return { user, isNew: true };
  }

  userTypeOf(user: { type: UserType }) {
    return user.type;
  }
}

export type TxClient = Prisma.TransactionClient;
