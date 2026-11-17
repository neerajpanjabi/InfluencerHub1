import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { hasPermission, type Permission } from '@influencehub/shared';
import { env } from '../../config/env';
import { PrismaService } from '../services/prisma.service';
import { CryptoService } from '../services/crypto.service';
import { ALLOW_PENDING_2FA, AuthUser, IS_PUBLIC, PERMISSIONS_KEY, SKIP_CSRF, USER_TYPES } from '../decorators';

export const ACCESS_COOKIE = 'ih_at';
export const REFRESH_COOKIE = 'ih_rt';
export const CSRF_COOKIE = 'ih_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface AccessClaims {
  sub: string;
  typ: AuthUser['type'];
  sid: string;
  tfa: boolean;
  loc: 'en' | 'ar';
}

/**
 * Global guard: parses the access token (cookie or Bearer), enforces CSRF double-submit for
 * cookie-authenticated unsafe requests, user-type restrictions, admin permissions and admin 2FA.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, targets);

    const bearer = (req.headers.authorization as string | undefined)?.startsWith('Bearer ') ? (req.headers.authorization as string).slice(7) : undefined;
    const cookieToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const token = bearer ?? cookieToken;

    // CSRF: any unsafe request that relies on cookies must carry a matching header token.
    if (!SAFE_METHODS.has(req.method) && !skipCsrf && !bearer && (cookieToken || req.cookies?.[REFRESH_COOKIE])) {
      const header = req.headers['x-csrf-token'] as string | undefined;
      const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
      if (!header || !cookie || !CryptoService.safeEqual(header, cookie)) throw new ForbiddenException({ code: 'CSRF_INVALID' });
    }

    if (token) {
      try {
        const claims = jwt.verify(token, env().JWT_SECRET, { algorithms: ['HS256'], audience: 'influencehub-api', issuer: 'influencehub' }) as unknown as AccessClaims;
        const session = await this.prisma.session.findUnique({ where: { id: claims.sid }, select: { revokedAt: true, expiresAt: true, user: { select: { status: true, roles: { select: { role: { select: { key: true } } } } } } } });
        if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'ACTIVE') {
          req.user = {
            id: claims.sub,
            type: claims.typ,
            sessionId: claims.sid,
            tfa: claims.tfa,
            locale: claims.loc,
            roles: session.user.roles.map((r) => r.role.key),
          } satisfies AuthUser;
        }
      } catch {
        /* invalid/expired token → treated as anonymous */
      }
    }

    if (isPublic) return true;
    const user = req.user as AuthUser | undefined;
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });

    const types = this.reflector.getAllAndOverride<string[]>(USER_TYPES, targets);
    const perms = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (perms?.length || types?.includes('ADMIN')) {
      if (user.type !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN' });
      const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_2FA, targets);
      if (!user.tfa && !allowPending) throw new ForbiddenException({ code: 'ADMIN_2FA_REQUIRED' });
    }
    if (types?.length && !types.includes(user.type)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    if (perms?.length && !hasPermission(user.roles, perms)) throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    return true;
  }
}
