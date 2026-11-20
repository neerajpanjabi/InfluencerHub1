import { env } from '../../../config/env';
import { CryptoService } from '../../../common/services/crypto.service';
import { CheckoutRequest, InvalidSignatureError, NormalizedWebhook, PaymentProvider, RefundRequest } from './types';

/**
 * Stripe Checkout adapter (REST, no SDK). Stripe supports AED for UAE-registered accounts —
 * eligibility and settlement arrangement must be confirmed with Stripe before go-live.
 * Webhook events used: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly isSandbox = false;

  isConfigured() {
    return !!(env().STRIPE_SECRET_KEY && env().STRIPE_WEBHOOK_SECRET);
  }

  private async call(path: string, params: Record<string, string>, idempotencyKey?: string) {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env().STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: new URLSearchParams(params),
    });
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${body?.error?.message ?? 'error'}`);
    return body;
  }

  async createCheckout(req: CheckoutRequest) {
    const s = await this.call(
      'checkout/sessions',
      {
        mode: 'payment',
        'line_items[0][price_data][currency]': req.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(req.amountMinor),
        'line_items[0][price_data][product_data][name]': req.description.slice(0, 250),
        'line_items[0][quantity]': '1',
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        client_reference_id: req.paymentId,
        'metadata[paymentId]': req.paymentId,
        'payment_intent_data[metadata][paymentId]': req.paymentId,
        ...(req.customerEmail ? { customer_email: req.customerEmail } : {}),
      },
      req.idempotencyKey,
    );
    return { providerSessionId: s.id, checkoutUrl: s.url };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedWebhook {
    const sig = String(headers['stripe-signature'] ?? '');
    const items = sig.split(',').map((kv) => kv.split('='));
    const t = items.find(([k]) => k === 't')?.[1];
    const v1s = items.filter(([k]) => k === 'v1').map(([, v]) => v);
    if (!t || !v1s.length) throw new InvalidSignatureError('Missing Stripe signature');
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new InvalidSignatureError('Stripe signature timestamp outside tolerance');
    const expected = CryptoService.hmacHex(env().STRIPE_WEBHOOK_SECRET!, `${t}.${rawBody.toString('utf8')}`);
    if (!v1s.some((v) => CryptoService.safeEqual(expected, v))) throw new InvalidSignatureError('Stripe signature mismatch');
    const evt = JSON.parse(rawBody.toString('utf8'));
    const obj = evt.data?.object ?? {};
    const map: Record<string, NormalizedWebhook['type']> = {
      'checkout.session.completed': obj.payment_status === 'paid' ? 'payment.succeeded' : 'ignored',
      'checkout.session.async_payment_succeeded': 'payment.succeeded',
      'checkout.session.async_payment_failed': 'payment.failed',
      'checkout.session.expired': 'payment.cancelled',
      'charge.refunded': 'refund.succeeded',
    };
    return {
      eventId: evt.id,
      type: map[evt.type] ?? 'ignored',
      providerSessionId: evt.type.startsWith('checkout.session') ? obj.id : undefined,
      providerPaymentId: obj.payment_intent ?? undefined,
      amountMinor: obj.amount_total ?? obj.amount_refunded,
      currency: obj.currency?.toUpperCase(),
      raw: evt,
    };
  }

  async refund(req: RefundRequest) {
    const r = await this.call('refunds', { payment_intent: req.providerPaymentId, amount: String(req.amountMinor), ...(req.reason ? { 'metadata[reason]': req.reason.slice(0, 200) } : {}) }, req.idempotencyKey);
    return { providerRefundId: r.id, status: r.status === 'succeeded' ? ('SUCCEEDED' as const) : r.status === 'failed' ? ('FAILED' as const) : ('PROCESSING' as const) };
  }
}
