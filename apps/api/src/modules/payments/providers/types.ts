export interface CheckoutRequest {
  paymentId: string;
  amountMinor: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  customerEmail?: string;
}

export interface CheckoutSession {
  providerSessionId: string;
  checkoutUrl: string;
}

export type WebhookEventType = 'payment.succeeded' | 'payment.failed' | 'payment.cancelled' | 'refund.succeeded' | 'refund.failed' | 'ignored';

export interface NormalizedWebhook {
  eventId: string;
  type: WebhookEventType;
  providerSessionId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountMinor?: number;
  currency?: string;
  processingFeeMinor?: number;
  raw: unknown;
}

export interface RefundRequest {
  providerPaymentId: string;
  amountMinor: number;
  idempotencyKey: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Verifies the signature over the RAW body and normalises the event. Throws on invalid signature. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedWebhook;
  refund(req: RefundRequest): Promise<{ providerRefundId: string; status: 'SUCCEEDED' | 'PROCESSING' | 'FAILED' }>;
}

export class InvalidSignatureError extends Error {}
