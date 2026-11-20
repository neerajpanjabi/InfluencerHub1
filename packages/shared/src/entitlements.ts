/**
 * Paid-contact entitlement rules. Viewing public profiles is always free; INITIATING direct
 * contact requires a valid entitlement (purchase, admin grant, free allowance or an existing
 * booking relationship).
 */
export interface ContactSettings {
  contactFee: string; // AED, VAT exclusive
  freeContactAllowance: number; // free unlocks per business (lifetime)
  accessDurationDays: number | null; // null = no expiry
  maxContactsPerDay: number;
  refundPolicy: 'NON_REFUNDABLE' | 'REFUNDABLE_IF_NO_REPLY_7_DAYS' | 'MANUAL_REVIEW';
  packages: Array<{ key: string; contacts: number; price: string }>;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  contactFee: '49.00',
  freeContactAllowance: 1,
  accessDurationDays: 365,
  maxContactsPerDay: 25,
  refundPolicy: 'REFUNDABLE_IF_NO_REPLY_7_DAYS',
  packages: [
    { key: 'pack_5', contacts: 5, price: '199.00' },
    { key: 'pack_15', contacts: 15, price: '499.00' },
  ],
};

export interface EntitlementRecord {
  source: 'PURCHASE' | 'ADMIN_GRANT' | 'FREE_ALLOWANCE' | 'BOOKING';
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
}

export function isEntitlementActive(e: EntitlementRecord, now = new Date()): boolean {
  if (e.revokedAt) return false;
  if (e.expiresAt && new Date(e.expiresAt) <= now) return false;
  return true;
}

export type ContactDecision =
  | { allowed: true; via: EntitlementRecord['source'] }
  | { allowed: false; reason: 'PAYMENT_REQUIRED'; fee: string; freeAllowanceAvailable: boolean }
  | { allowed: false; reason: 'INFLUENCER_NOT_CONTACTABLE' | 'BLOCKED' | 'DAILY_LIMIT_REACHED' | 'BUSINESS_NOT_ACTIVE' };

export interface ContactCheckInput {
  entitlements: EntitlementRecord[];
  influencerContactable: boolean;
  blocked: boolean;
  businessActive: boolean;
  freeContactsUsed: number;
  adminFreeCredits: number;
  contactsUnlockedToday: number;
  settings: ContactSettings;
  now?: Date;
}

export function evaluateContact(input: ContactCheckInput): ContactDecision {
  const now = input.now ?? new Date();
  if (!input.businessActive) return { allowed: false, reason: 'BUSINESS_NOT_ACTIVE' };
  if (input.blocked) return { allowed: false, reason: 'BLOCKED' };
  if (!input.influencerContactable) return { allowed: false, reason: 'INFLUENCER_NOT_CONTACTABLE' };
  const active = input.entitlements.find((e) => isEntitlementActive(e, now));
  if (active) return { allowed: true, via: active.source };
  if (input.contactsUnlockedToday >= input.settings.maxContactsPerDay) return { allowed: false, reason: 'DAILY_LIMIT_REACHED' };
  const freeAvailable = input.freeContactsUsed < input.settings.freeContactAllowance + input.adminFreeCredits;
  return { allowed: false, reason: 'PAYMENT_REQUIRED', fee: input.settings.contactFee, freeAllowanceAvailable: freeAvailable };
}

export function entitlementExpiry(settings: ContactSettings, from = new Date()): Date | null {
  if (settings.accessDurationDays == null) return null;
  return new Date(from.getTime() + settings.accessDurationDays * 86_400_000);
}
