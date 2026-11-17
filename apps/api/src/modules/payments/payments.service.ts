import { BadRequestException, forwardRef, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Payment, Prisma } from '@influencehub/database';
import { fromMinor, toMinor } from '@influencehub/shared';
import { env } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SandboxPaymentProvider } from './providers/sandbox.provider';
import { StripePaymentProvider } from './providers/stripe.provider';
import { InvalidSignatureError, NormalizedWebhook, PaymentProvider } from './providers/types';
import { FulfilmentService } from '../commerce/fulfilment.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private providers: Record<string, PaymentProvider> = { sandbox: new SandboxPaymentProvider(), stripe: new StripePaymentProvider() };

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => FulfilmentService)) private readonly fulfilment: FulfilmentService,
  ) {}

  provider(name?: string): PaymentProvider {
    const p = this.providers[name ?? env().PAYMENT_PROVIDER];
    if (!p || !p.isConfigured()) throw new ServiceUnavailableException({ code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' });
    return p;
  }

  providerStatus() {
    return Object.values(this.providers).map((p) => ({ name: p.name, sandbox: p.isSandbox, configured: p.isConfigured(), active: p.name === env().PAYMENT_PROVIDER }));
  }

  /** Creates (or reuses, by idempotency key) a hosted checkout for an existing Payment row. */
  async startCheckout(payment: Payment, description: string, successPath: string, cancelPath: string, customerEmail?: string) {
    if (payment.checkoutUrl && payment.status !== 'FAILED' && payment.status !== 'CANCELLED') return { paymentId: payment.id, checkoutUrl: payment.checkoutUrl };
    const provider = this.provider(payment.provider);
    const web = env().WEB_ORIGIN;
    const session = await provider.createCheckout({
      paymentId: payment.id,
      amountMinor: toMinor(payment.amount.toString()),
      currency: payment.currency,
      description,
      successUrl: `${web}${successPath}${successPath.includes('?') ? '&' : '?'}payment=${payment.id}`,
      cancelUrl: `${web}${cancelPath}`,
      idempotencyKey: `checkout-${payment.idempotencyKey}`,
      customerEmail,
    });
    const updated = await this.prisma.payment.update({ where: { id: payment.id }, data: { providerSessionId: session.providerSessionId, checkoutUrl: session.checkoutUrl, status: 'PENDING' } });
    return { paymentId: updated.id, checkoutUrl: session.checkoutUrl };
  }

  /**
   * Webhook entry point. Order of operations guarantees idempotency:
   *  1) verify signature on raw body  2) insert payment_event (unique per provider event id)
   *  3) lock payment row FOR UPDATE and apply state transition exactly once.
   */
  async handleWebhook(providerName: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const provider = this.providers[providerName];
    if (!provider || !provider.isConfigured()) throw new BadRequestException({ code: 'UNKNOWN_PROVIDER' });
    let evt: NormalizedWebhook;
    try {
      evt = provider.parseWebhook(rawBody, headers);
    } catch (e) {
      this.logger.warn(`Rejected ${providerName} webhook: ${(e as Error).message}`);
      await this.audit.log({}, 'payments.webhook.invalid_signature', 'PaymentEvent', null, undefined, { provider: providerName });
      throw new BadRequestException({ code: e instanceof InvalidSignatureError ? 'INVALID_SIGNATURE' : 'INVALID_PAYLOAD' });
    }
    if (!evt.eventId) throw new BadRequestException({ code: 'INVALID_PAYLOAD' });

    let eventRow;
    try {
      eventRow = await this.prisma.paymentEvent.create({ data: { provider: providerName, providerEventId: evt.eventId, type: evt.type, payload: evt.raw as Prisma.InputJsonValue, signatureValid: true } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { received: true, duplicate: true };
      throw e;
    }
    if (evt.type === 'ignored') {
      await this.prisma.paymentEvent.update({ where: { id: eventRow.id }, data: { processedAt: new Date() } });
      return { received: true };
    }
    try {
      const result = await this.apply(providerName, evt, eventRow.id);
      await this.prisma.paymentEvent.update({ where: { id: eventRow.id }, data: { processedAt: new Date(), paymentId: result?.paymentId } });
      if (result?.after) await result.after();
      return { received: true };
    } catch (e) {
      await this.prisma.paymentEvent.update({ where: { id: eventRow.id }, data: { error: (e as Error).message.slice(0, 1000) } });
      this.logger.error(`Webhook processing failed ${evt.eventId}: ${(e as Error).message}`);
      // Delete the event marker so the provider's retry can be processed again.
      await this.prisma.paymentEvent.delete({ where: { id: eventRow.id } }).catch(() => undefined);
      throw e;
    }
  }

  private async apply(providerName: string, evt: NormalizedWebhook, _eventRowId: string): Promise<{ paymentId?: string; after?: () => Promise<void> } | undefined> {
    if (evt.type.startsWith('refund.')) return undefined; // refunds are initiated by us and settled synchronously; logged only
    const payment = await this.prisma.payment.findFirst({ where: { provider: providerName, providerSessionId: evt.providerSessionId } });
    if (!payment) throw new BadRequestException({ code: 'UNKNOWN_PAYMENT' });

    let after: (() => Promise<void>) | undefined;
    await this.prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<Payment[]>`SELECT * FROM payments WHERE id = ${payment.id}::uuid FOR UPDATE`;
        if (locked.status === 'SUCCEEDED' || locked.status === 'REFUNDED' || locked.status === 'PARTIALLY_REFUNDED') return; // already applied
        if (evt.type === 'payment.succeeded') {
          const expected = toMinor(locked.amount.toString());
          if (evt.amountMinor != null && evt.amountMinor !== expected) throw new Error(`Amount mismatch for payment ${locked.id}: ${evt.amountMinor} != ${expected}`);
          if (evt.currency && evt.currency.toUpperCase() !== locked.currency) throw new Error('Currency mismatch');
          await tx.payment.update({
            where: { id: locked.id },
            data: { status: 'SUCCEEDED', succeededAt: new Date(), providerPaymentId: evt.providerPaymentId ?? locked.providerPaymentId, processingFee: evt.processingFeeMinor != null ? fromMinor(evt.processingFeeMinor) : undefined },
          });
          after = await this.fulfilment.onPaymentSucceeded(tx, { ...locked, processingFee: evt.processingFeeMinor != null ? new Prisma.Decimal(fromMinor(evt.processingFeeMinor)) : locked.processingFee });
        } else {
          const status = evt.type === 'payment.cancelled' ? 'CANCELLED' : 'FAILED';
          await tx.payment.update({ where: { id: locked.id }, data: { status, failureReason: evt.type } });
          after = await this.fulfilment.onPaymentFailed(tx, locked);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
    );
    return { paymentId: payment.id, after };
  }

  /** Sandbox-only: simulate the provider sending a signed webhook for a checkout session. */
  async simulateSandboxOutcome(sessionId: string, outcome: 'succeeded' | 'failed') {
    const payment = await this.prisma.payment.findFirst({ where: { provider: 'sandbox', providerSessionId: sessionId } });
    if (!payment) throw new BadRequestException({ code: 'UNKNOWN_PAYMENT' });
    const amount = toMinor(payment.amount.toString());
    const body = JSON.stringify({
      id: `sbx_evt_${sessionId}_${outcome}`,
      type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
      data: { sessionId, paymentId: `sbx_pi_${sessionId}`, amount, currency: payment.currency, fee: Math.round(amount * 0.029) + 100 },
    });
    await this.handleWebhook('sandbox', Buffer.from(body), { 'x-sandbox-signature': SandboxPaymentProvider.sign(body) });
    return payment;
  }
}
