import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { env } from '../../config/env';

/**
 * Rate limiting (per IP + route). For multi-instance deployments configure a Redis-backed
 * throttler storage (see DEPLOYMENT.md). In the automated test environment limits are only
 * enforced for requests that opt in via `x-test-rate-limit`, so functional tests stay deterministic
 * while the dedicated rate-limit security test still exercises the real guard.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (env().APP_ENV === 'test' && !req.headers['x-test-rate-limit']) return true;
    return super.shouldSkip(ctx);
  }
}
