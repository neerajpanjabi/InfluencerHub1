import { percentOf } from './money';

export type TaxTreatment = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT' | 'OUT_OF_SCOPE';

export interface VatConfig {
  /** UAE standard rate is 5% at time of writing. Configurable by Finance Admin. */
  standardRate: number;
  /** Whether listed prices already include VAT. InfluenceHub lists prices exclusive of VAT. */
  pricesIncludeVat: boolean;
  /** Whether the platform is VAT registered (TRN on file). If false, no VAT is charged. */
  platformVatRegistered: boolean;
}

export const DEFAULT_VAT_CONFIG: VatConfig = {
  standardRate: 5,
  pricesIncludeVat: false,
  platformVatRegistered: true,
};

/** Returns VAT (minor units) chargeable on a net amount. */
export function calculateVat(netMinor: number, treatment: TaxTreatment, cfg: VatConfig = DEFAULT_VAT_CONFIG): number {
  if (!cfg.platformVatRegistered) return 0;
  if (treatment !== 'STANDARD') return 0;
  if (cfg.pricesIncludeVat) {
    // Extract VAT from a gross figure: gross * r / (100 + r)
    return Math.round((netMinor * cfg.standardRate) / (100 + cfg.standardRate));
  }
  return percentOf(netMinor, cfg.standardRate);
}
