import { describe, it, expect } from 'vitest';
import { toMinor, fromMinor, percentOf, calculateVat, calculateCommission, commissionReversal, DEFAULT_COMMISSION_CONFIG } from './index';

describe('money', () => {
  it('converts decimal strings to minor units without float drift', () => {
    expect(toMinor('0.1')).toBe(10);
    expect(toMinor('1250.00')).toBe(125000);
    expect(toMinor('19.995')).toBe(2000);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(fromMinor(125005)).toBe('1250.05');
    expect(fromMinor(-5)).toBe('-0.05');
  });
  it('rejects invalid input', () => {
    expect(() => toMinor('abc')).toThrow();
    expect(() => fromMinor(1.5)).toThrow();
  });
  it('computes percentages with half-up rounding', () => {
    expect(percentOf(100000, 15)).toBe(15000);
    expect(percentOf(333, 5)).toBe(17); // 16.65 -> 17
    expect(percentOf(1, 50)).toBe(1); // 0.5 -> 1
  });
});

describe('VAT', () => {
  it('applies 5% UAE standard rate on standard-rated supplies', () => {
    expect(calculateVat(100000, 'STANDARD')).toBe(5000);
  });
  it('charges no VAT on zero-rated/exempt/out-of-scope', () => {
    expect(calculateVat(100000, 'ZERO_RATED')).toBe(0);
    expect(calculateVat(100000, 'EXEMPT')).toBe(0);
    expect(calculateVat(100000, 'OUT_OF_SCOPE')).toBe(0);
  });
  it('charges no VAT when platform is not VAT registered', () => {
    expect(calculateVat(100000, 'STANDARD', { standardRate: 5, pricesIncludeVat: false, platformVatRegistered: false })).toBe(0);
  });
  it('extracts VAT from inclusive prices', () => {
    expect(calculateVat(105000, 'STANDARD', { standardRate: 5, pricesIncludeVat: true, platformVatRegistered: true })).toBe(5000);
  });
});

describe('commission', () => {
  it('defaults to influencer-paid commission', () => {
    const r = calculateCommission(DEFAULT_COMMISSION_CONFIG, { grossMinor: 200000 });
    expect(r.rate).toBe(15);
    expect(r.totalCommission).toBe(30000);
    expect(r.influencerPortion).toBe(30000);
    expect(r.businessPortion).toBe(0);
    expect(r.influencerNet).toBe(170000);
  });
  it('supports business-paid commission', () => {
    const r = calculateCommission({ ...DEFAULT_COMMISSION_CONFIG, payer: 'BUSINESS' }, { grossMinor: 200000 });
    expect(r.businessPortion).toBe(30000);
    expect(r.influencerNet).toBe(200000);
  });
  it('splits commission', () => {
    const r = calculateCommission({ ...DEFAULT_COMMISSION_CONFIG, payer: 'SPLIT', splitBusinessShare: 40 }, { grossMinor: 100000 });
    expect(r.businessPortion).toBe(6000);
    expect(r.influencerPortion).toBe(9000);
    expect(r.totalCommission).toBe(15000);
  });
  it('prefers service rate over category rate over default', () => {
    const cfg = { ...DEFAULT_COMMISSION_CONFIG, categoryRates: { cat1: 12 }, serviceRates: { ig_reel: 10 } };
    expect(calculateCommission(cfg, { grossMinor: 100000, categoryId: 'cat1', serviceKey: 'ig_reel' }).rate).toBe(10);
    expect(calculateCommission(cfg, { grossMinor: 100000, categoryId: 'cat1', serviceKey: 'x' }).rate).toBe(12);
    expect(calculateCommission(cfg, { grossMinor: 100000 }).rate).toBe(15);
  });
  it('applies min and max commission', () => {
    expect(calculateCommission({ ...DEFAULT_COMMISSION_CONFIG, minCommission: '50' }, { grossMinor: 10000 }).totalCommission).toBe(5000);
    expect(calculateCommission({ ...DEFAULT_COMMISSION_CONFIG, maxCommission: '100' }, { grossMinor: 1000000 }).totalCommission).toBe(10000);
  });
  it('never deducts more than the gross from the influencer', () => {
    const r = calculateCommission({ ...DEFAULT_COMMISSION_CONFIG, minCommission: '500' }, { grossMinor: 10000 });
    expect(r.influencerNet).toBe(0);
  });
  it('reverses commission proportionally on partial refunds', () => {
    const c = calculateCommission(DEFAULT_COMMISSION_CONFIG, { grossMinor: 100000 });
    const rev = commissionReversal(100000, 50000, c);
    expect(rev.influencerPortion).toBe(7500);
    expect(rev.influencerNet).toBe(42500);
    expect(() => commissionReversal(100000, 200000, c)).toThrow();
  });
  it('rejects negative amounts', () => {
    expect(() => calculateCommission(DEFAULT_COMMISSION_CONFIG, { grossMinor: -1 })).toThrow();
  });
});
