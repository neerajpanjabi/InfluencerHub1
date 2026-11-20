import { calculateCommission, calculateVat, fromMinor, percentOf, type CommissionConfig, type VatConfig, type TaxTreatment } from '@influencehub/shared';

export interface PricedLineInput {
  key: string;
  influencerId: string;
  influencerName: string;
  description: string;
  platform: string;
  quantity: number;
  unitPriceMinor: number;
  addOnsMinor: number;
  serviceKey?: string | null;
  categoryId?: string | null;
  taxTreatment: TaxTreatment;
  deliveryDays: number;
  serviceId?: string | null;
  packageId?: string | null;
  quotationId?: string | null;
  snapshot: Record<string, unknown>;
}

export interface PricedLine extends PricedLineInput {
  discountMinor: number;
  grossMinor: number;
  commissionRate: number;
  commissionPayer: 'BUSINESS' | 'INFLUENCER' | 'SPLIT';
  businessCommissionMinor: number;
  influencerCommissionMinor: number;
  vatMinor: number;
  influencerNetMinor: number;
  lineTotalMinor: number; // what the business pays for the line
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalMinor: number; // before discount
  discountMinor: number;
  businessCommissionMinor: number;
  vatMinor: number;
  grandTotalMinor: number;
  vatRate: number;
}

/**
 * Server-side, integer-minor-unit pricing for carts and orders. VAT is charged on what the business
 * pays (creator price after discount + any business-borne commission) per line tax treatment.
 */
export function priceLines(inputs: PricedLineInput[], commission: CommissionConfig, vat: VatConfig, discount?: { percentOff?: number | null; amountOffMinor?: number | null }): PricedCart {
  const base = inputs.map((l) => l.unitPriceMinor * l.quantity + l.addOnsMinor);
  const subtotal = base.reduce((a, b) => a + b, 0);
  let discountTotal = 0;
  if (discount?.percentOff) discountTotal = percentOf(subtotal, discount.percentOff);
  else if (discount?.amountOffMinor) discountTotal = Math.min(subtotal, discount.amountOffMinor);
  // Allocate discount proportionally; last line absorbs rounding.
  let allocated = 0;
  const lines: PricedLine[] = inputs.map((l, i) => {
    const share = i === inputs.length - 1 ? discountTotal - allocated : subtotal ? Math.round((discountTotal * base[i]) / subtotal) : 0;
    allocated += share;
    const gross = base[i] - share;
    const c = calculateCommission(commission, { grossMinor: gross, categoryId: l.categoryId, serviceKey: l.serviceKey });
    const vatMinor = calculateVat(gross + c.businessPortion, l.taxTreatment, vat);
    return {
      ...l,
      discountMinor: share,
      grossMinor: gross,
      commissionRate: c.rate,
      commissionPayer: c.payer,
      businessCommissionMinor: c.businessPortion,
      influencerCommissionMinor: c.influencerPortion,
      vatMinor,
      influencerNetMinor: c.influencerNet,
      lineTotalMinor: gross + c.businessPortion + vatMinor,
    };
  });
  return {
    lines,
    subtotalMinor: subtotal,
    discountMinor: discountTotal,
    businessCommissionMinor: lines.reduce((a, l) => a + l.businessCommissionMinor, 0),
    vatMinor: lines.reduce((a, l) => a + l.vatMinor, 0),
    grandTotalMinor: lines.reduce((a, l) => a + l.lineTotalMinor, 0),
    vatRate: vat.platformVatRegistered ? vat.standardRate : 0,
  };
}

export function serializeCart(c: PricedCart) {
  return {
    lines: c.lines.map((l) => ({
      key: l.key,
      influencerId: l.influencerId,
      influencerName: l.influencerName,
      description: l.description,
      platform: l.platform,
      quantity: l.quantity,
      unitPrice: fromMinor(l.unitPriceMinor),
      addOns: fromMinor(l.addOnsMinor),
      discount: fromMinor(l.discountMinor),
      gross: fromMinor(l.grossMinor),
      businessCommission: fromMinor(l.businessCommissionMinor),
      vat: fromMinor(l.vatMinor),
      lineTotal: fromMinor(l.lineTotalMinor),
      deliveryDays: l.deliveryDays,
    })),
    subtotal: fromMinor(c.subtotalMinor),
    discount: fromMinor(c.discountMinor),
    serviceFee: fromMinor(c.businessCommissionMinor),
    vat: fromMinor(c.vatMinor),
    total: fromMinor(c.grandTotalMinor),
    vatRate: c.vatRate,
    currency: 'AED',
  };
}
