import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '@influencehub/shared';

export const IS_PUBLIC = 'isPublic';
export const USER_TYPES = 'userTypes';
export const PERMISSIONS_KEY = 'permissions';
export const SKIP_CSRF = 'skipCsrf';
export const ALLOW_PENDING_2FA = 'allowPending2fa';

/** Route does not require authentication (auth is still parsed if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Restrict to user types (BUSINESS / INFLUENCER / ADMIN). */
export const UserTypes = (...types: Array<'BUSINESS' | 'INFLUENCER' | 'ADMIN'>) => SetMetadata(USER_TYPES, types);
/** Admin permission check (implies ADMIN user type and completed 2FA). */
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms);
/** Server-to-server endpoints (payment webhooks) that are authenticated by signature, not cookies. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);
/** Admin endpoints reachable before 2FA enrolment completes (2FA setup itself). */
export const AllowPending2fa = () => SetMetadata(ALLOW_PENDING_2FA, true);

export interface AuthUser {
  id: string;
  type: 'BUSINESS' | 'INFLUENCER' | 'ADMIN';
  roles: string[];
  sessionId: string;
  tfa: boolean;
  locale: 'en' | 'ar';
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

export const ReqMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return { ip: req.ip as string, userAgent: (req.headers['user-agent'] as string) ?? null, actorId: req.user?.id ?? null };
});
