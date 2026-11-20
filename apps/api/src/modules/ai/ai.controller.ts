import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { AiService } from './ai.service';

const schema = z.object({ query: z.string().trim().min(3).max(500), previous: z.record(z.any()).optional(), locale: z.enum(['en', 'ar']).default('en') });

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Public so visitors can try discovery; signed-in businesses get logged recommendations. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('recommendations')
  recommend(@CurrentUser() u: AuthUser | undefined, @Body(zbody(schema)) b: z.infer<typeof schema>) {
    return this.ai.recommend({ query: b.query, previous: b.previous as any, locale: b.locale, userId: u?.id, businessUserId: u?.type === 'BUSINESS' ? u.id : undefined });
  }

  @UserTypes('BUSINESS')
  @Post('feedback')
  feedback(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ recommendationId: z.string().uuid(), helpful: z.boolean(), comment: z.string().max(1000).optional() }))) b: any) {
    return this.ai.feedback(u.id, b.recommendationId, b.helpful, b.comment);
  }
}
