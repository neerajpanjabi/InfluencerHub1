import { percentOf } from './money';

export type CommissionPayer = 'BUSINESS' | 'INFLUENCER' | 'SPLIT';

export interface CommissionConfig {
  defaultRate: number; // percent
  payer: CommissionPayer;
  /** Business share of commission when payer = SPLIT (percent of the commission, 0..100). */
  splitBusinessShare: number;
  minCommission?: string | null; // AED, per line item
  maxCommission?: string | null;
  categoryRates?: Record<string, number>; // categoryId -> percent
  serviceRates?: Record<string, number>; // service catalog key -> percent
}

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  defaultRate: 15,
  payer: 'INFLUENCER',
  splitBusinessShare: 50,
  minCommission: null,
  maxCommission: null,
  categoryRates: {},
  serviceRates: {},
};

export interface CommissionInput {
  grossMinor: number; // creator price for the line (after discounts)
  categoryId?: string | null;
  serviceKey?: string | null;
}

export interface CommissionResult {
  rate: number;
  payer: CommissionPayer;
  totalCommission: number;
  businessPortion: number; // added on top of business invoice
  influencerPortion: number; // deducted from influencer payout
  influencerNet: number; // gross - influencerPortion
}

/** Resolve the applicable rate: service-specific > category-specific > default. */
export function resolveCommissionRate(cfg: CommissionConfig, input: Pick<CommissionInput, 'categoryId' | 'serviceKey'>): number {
  if (input.serviceKey && cfg.serviceRates && cfg.serviceRates[input.serviceKey] != null) {
    return cfg.serviceRates[input.serviceKey];
  }
  if (input.categoryId && cfg.categoryRates && cfg.categoryRates[input.categoryId] != null) {
    return cfg.categoryRates[input.categoryId];
  }
  return cfg.defaultRate;
}

export function calculateCommission(cfg: CommissionConfig, input: CommissionInput): CommissionResult {
  if (input.grossMinor < 0) throw new Error('Gross amount cannot be negative');
  const rate = resolveCommissionRate(cfg, input);
  let total = percentOf(input.grossMinor, rate);
  if (cfg.minCommission != null && cfg.minCommission !== '') {
    total = Math.max(total, Math.round(parseFloat(cfg.minCommission) * 100));
  }
  if (cfg.maxCommission != null && cfg.maxCommission !== '') {
    total = Math.min(total, Math.round(parseFloat(cfg.maxCommission) * 100));
  }
  // Commission can never exceed the gross line value when influencer pays.
  let businessPortion = 0;
  let influencerPortion = 0;
  if (cfg.payer === 'BUSINESS') businessPortion = total;
  else if (cfg.payer === 'INFLUENCER') influencerPortion = Math.min(total, input.grossMinor);
  else {
    businessPortion = Math.round((total * cfg.splitBusinessShare) / 100);
    influencerPortion = Math.min(total - businessPortion, input.grossMinor);
  }
  total = businessPortion + influencerPortion;
  return {
    rate,
    payer: cfg.payer,
    totalCommission: total,
    businessPortion,
    influencerPortion,
    influencerNet: input.grossMinor - influencerPortion,
  };
}

/** Proportional commission reversal for a (partial) refund of a line item. */
export function commissionReversal(lineGrossMinor: number, refundMinor: number, commission: CommissionResult) {
  if (refundMinor > lineGrossMinor) throw new Error('Refund exceeds line value');
  const ratio = lineGrossMinor === 0 ? 0 : refundMinor / lineGrossMinor;
  return {
    businessPortion: Math.round(commission.businessPortion * ratio),
    influencerPortion: Math.round(commission.influencerPortion * ratio),
    influencerNet: Math.round(commission.influencerNet * ratio),
  };
}
