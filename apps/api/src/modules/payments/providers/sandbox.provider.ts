import { env, sandboxAllowed } from '../../../config/env';
import { CryptoService } from '../../../common/services/crypto.service';
import { CheckoutRequest, InvalidSignatureError, NormalizedWebhook, PaymentProvider, RefundRequest } from './types';

/**
 * SANDBOX payment provider — simulated hosted checkout for development and automated tests.
 * Mirrors a real gateway: hosted page → signed webhook (HMAC-SHA256 over `${t}.${body}`) → redirect.
 * Cannot be enabled in production (env guard). Never moves real money.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';
  readonly isSandbox = true;

  isConfigured() {
    return sandboxAllowed();
  }

  async createCheckout(req: CheckoutRequest) {
    const sessionId = `sbx_cs_${CryptoService.randomToken(12)}`;
    return { providerSessionId: sessionId, checkoutUrl: `${env().API_PUBLIC_URL}/payments/sandbox/checkout/${sessionId}` };
  }

  static sign(body: string, timestamp = Math.floor(Date.now() / 1000)) {
    return `t=${timestamp},v1=${CryptoService.hmacHex(env().SANDBOX_WEBHOOK_SECRET, `${timestamp}.${body}`)}`;
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedWebhook {
    const sig = String(headers['x-sandbox-signature'] ?? '');
    const parts = Object.fromEntries(sig.split(',').map((kv) => kv.split('=') as [string, string]));
    const t = Number(parts.t);
    if (!parts.t || !parts.v1 || !Number.isFinite(t)) throw new InvalidSignatureError('Missing signature');
    if (Math.abs(Date.now() / 1000 - t) > 300) throw new InvalidSignatureError('Signature timestamp outside tolerance');
    const expected = CryptoService.hmacHex(env().SANDBOX_WEBHOOK_SECRET, `${t}.${rawBody.toString('utf8')}`);
    if (!CryptoService.safeEqual(expected, parts.v1)) throw new InvalidSignatureError('Signature mismatch');
    const evt = JSON.parse(rawBody.toString('utf8'));
    return {
      eventId: evt.id,
      type: evt.type,
      providerSessionId: evt.data?.sessionId,
      providerPaymentId: evt.data?.paymentId,
      providerRefundId: evt.data?.refundId,
      amountMinor: evt.data?.amount,
      currency: evt.data?.currency,
      processingFeeMinor: evt.data?.fee,
      raw: evt,
    };
  }

  async refund(req: RefundRequest) {
    if (req.amountMinor <= 0) return { providerRefundId: '', status: 'FAILED' as const };
    return { providerRefundId: `sbx_re_${CryptoService.randomToken(10)}`, status: 'SUCCEEDED' as const };
  }
}
