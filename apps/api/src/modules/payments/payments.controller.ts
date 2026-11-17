import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { env, sandboxAllowed } from '../../config/env';
import { Public, SkipCsrf } from '../../common/decorators';
import { PrismaService } from '../../common/services/prisma.service';
import { escapeHtml } from '../notifications/templates';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private readonly prisma: PrismaService) {}

  /** Provider webhooks — authenticated by signature over the raw body, idempotent per event id. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhooks/:provider')
  webhook(@Param('provider') provider: string, @Req() req: Request & { rawBody?: Buffer }) {
    return this.payments.handleWebhook(provider, req.rawBody ?? Buffer.from(''), req.headers as any);
  }

  /** SANDBOX hosted checkout page. 404 outside sandbox-enabled environments. */
  @Public()
  @ApiExcludeEndpoint()
  @Get('sandbox/checkout/:sessionId')
  async sandboxPage(@Param('sessionId') sessionId: string, @Res() res: Response) {
    if (!sandboxAllowed() || env().PAYMENT_PROVIDER !== 'sandbox') throw new NotFoundException();
    const p = await this.prisma.payment.findFirst({ where: { provider: 'sandbox', providerSessionId: sessionId } });
    if (!p) throw new NotFoundException();
    const action = `${env().API_PUBLIC_URL}/payments/sandbox/checkout/${encodeURIComponent(sessionId)}/complete`;
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' " + new URL(env().API_PUBLIC_URL).origin + ' ' + new URL(env().WEB_ORIGIN).origin);
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox checkout</title>
<style>body{font-family:system-ui;background:#f6f5f2;color:#0b1b33;display:grid;place-items:center;min-height:100vh;margin:0}.c{background:#fff;padding:32px;border-radius:8px;width:360px;box-shadow:0 8px 30px rgba(11,27,51,.08);border-top:4px solid #c8a96a}
.b{background:#fff4d6;color:#7a5b12;padding:6px 10px;border-radius:4px;font-size:12px;font-weight:600}.amt{font-size:32px;font-weight:700;margin:16px 0}button{width:100%;padding:12px;border-radius:6px;border:0;margin-top:8px;cursor:pointer;font-size:15px}.ok{background:#0b1b33;color:#fff}.no{background:#eee;color:#333}</style></head>
<body><div class="c"><span class="b">SANDBOX — no real money moves</span><h2>InfluenceHub test checkout</h2><div class="amt">AED ${escapeHtml(p.amount.toString())}</div>
<form method="post" action="${escapeHtml(action)}"><button class="ok" name="outcome" value="succeeded">Pay (test card 4242)</button><button class="no" name="outcome" value="failed">Simulate failure</button></form></div></body></html>`);
  }

  @Public()
  @SkipCsrf()
  @ApiExcludeEndpoint()
  @Post('sandbox/checkout/:sessionId/complete')
  async sandboxComplete(@Param('sessionId') sessionId: string, @Body() body: { outcome?: string }, @Res() res: Response) {
    if (!sandboxAllowed() || env().PAYMENT_PROVIDER !== 'sandbox') throw new NotFoundException();
    const outcome = body?.outcome === 'failed' ? 'failed' : 'succeeded';
    const payment = await this.payments.simulateSandboxOutcome(sessionId, outcome);
    const full = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { contactPurchase: { include: { influencer: true } } } });
    const web = env().WEB_ORIGIN;
    if (full.orderId) return res.redirect(`${web}/en/business/orders/${full.orderId}?payment=${outcome}`);
    return res.redirect(`${web}/en/creators/${full.contactPurchase?.influencer.slug}?contact=${outcome === 'succeeded' ? 'success' : 'failed'}`);
  }

  @Public()
  @Get('providers')
  providers() {
    return this.payments.providerStatus().map(({ name, sandbox, active }) => ({ name, sandbox, active }));
  }
}
