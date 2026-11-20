import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { canonicalJson, financialTermsSchema, type SignedAgreementDocument } from './agreements';

const agreementContentHash = (d: SignedAgreementDocument) => createHash('sha256').update(canonicalJson(d)).digest('hex');

const base = { number: 'AGR-2026-001001', version: 1, businessId: 'b', influencerId: 'i', title: 'T', clauses: [{ heading: 'A', body: 'B' }], financialTerms: { totalAmount: '1000.00' } };

describe('agreements', () => {
  it('canonical JSON ignores key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
  it('hash changes when any signed content changes', () => {
    const h = agreementContentHash(base);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(agreementContentHash({ ...base })).toBe(h);
    expect(agreementContentHash({ ...base, version: 2 })).not.toBe(h);
    expect(agreementContentHash({ ...base, financialTerms: { totalAmount: '1000.01' } })).not.toBe(h);
    expect(agreementContentHash({ ...base, clauses: [{ heading: 'A', body: 'B.' }] })).not.toBe(h);
  });
  it('requires the payment schedule to total exactly 100%', () => {
    const ok = { totalAmount: '5000', vatTreatment: 'EXCLUSIVE', paymentSchedule: [{ description: 'Deposit', percentage: 50 }, { description: 'On delivery', percentage: 50 }] };
    expect(financialTermsSchema.safeParse(ok).success).toBe(true);
    expect(financialTermsSchema.safeParse({ ...ok, paymentSchedule: [{ description: 'Deposit', percentage: 60 }] }).success).toBe(false);
    expect(financialTermsSchema.safeParse({ ...ok, totalAmount: '0' }).success).toBe(false);
    expect(financialTermsSchema.safeParse({ ...ok, totalAmount: '12.345' }).success).toBe(false);
  });
});
