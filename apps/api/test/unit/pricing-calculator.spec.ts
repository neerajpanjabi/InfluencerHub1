import { DEFAULT_COMMISSION_CONFIG, DEFAULT_VAT_CONFIG, parseQuery } from '@influencehub/shared';
import { priceLines, PricedLineInput } from '../../src/modules/commerce/pricing-calculator';
import { mergeParsed } from '../../src/modules/ai/ai.service';
import { deriveMetrics } from '../../src/modules/social/social.service';
import { sanitizeRedirect } from '../../src/modules/auth/oauth-state.service';

const line = (over: Partial<PricedLineInput> = {}): PricedLineInput => ({
  key: 'l1', influencerId: 'i1', influencerName: 'A', description: 'Reel', platform: 'INSTAGRAM', quantity: 1, unitPriceMinor: 100000, addOnsMinor: 0,
  taxTreatment: 'STANDARD', deliveryDays: 5, snapshot: {}, ...over,
});

describe('cart pricing calculator', () => {
  it('computes VAT on business payable and influencer-paid commission', () => {
    const r = priceLines([line()], DEFAULT_COMMISSION_CONFIG, DEFAULT_VAT_CONFIG);
    expect(r.lines[0].vatMinor).toBe(5000);
    expect(r.lines[0].influencerCommissionMinor).toBe(15000);
    expect(r.lines[0].influencerNetMinor).toBe(85000);
    expect(r.grandTotalMinor).toBe(105000);
  });
  it('adds business-paid commission to the invoice and charges VAT on it', () => {
    const r = priceLines([line()], { ...DEFAULT_COMMISSION_CONFIG, payer: 'BUSINESS' }, DEFAULT_VAT_CONFIG);
    expect(r.businessCommissionMinor).toBe(15000);
    expect(r.vatMinor).toBe(5750);
    expect(r.grandTotalMinor).toBe(120750);
  });
  it('allocates discounts across lines exactly', () => {
    const r = priceLines([line({ key: 'a', unitPriceMinor: 33333 }), line({ key: 'b', unitPriceMinor: 66667 })], DEFAULT_COMMISSION_CONFIG, DEFAULT_VAT_CONFIG, { percentOff: 10 });
    expect(r.discountMinor).toBe(10000);
    expect(r.lines.reduce((a, l) => a + l.discountMinor, 0)).toBe(10000);
    expect(r.lines.reduce((a, l) => a + l.grossMinor, 0)).toBe(90000);
  });
  it('does not charge VAT on zero-rated lines and multiplies quantity and add-ons', () => {
    const r = priceLines([line({ taxTreatment: 'ZERO_RATED', quantity: 3, addOnsMinor: 3000 })], DEFAULT_COMMISSION_CONFIG, DEFAULT_VAT_CONFIG);
    expect(r.vatMinor).toBe(0);
    expect(r.subtotalMinor).toBe(303000);
  });
  it('caps fixed discounts at subtotal', () => {
    const r = priceLines([line()], DEFAULT_COMMISSION_CONFIG, DEFAULT_VAT_CONFIG, { amountOffMinor: 999999999 });
    expect(r.grandTotalMinor).toBe(0);
  });
});

describe('AI conversational refinement', () => {
  it('keeps prior intent and overrides only mentioned dimensions', () => {
    const first = parseQuery('Find food influencers in Sharjah with at least 20,000 followers');
    const merged = mergeParsed(first, parseQuery('actually in Dubai'));
    expect(merged.categories).toContain('restaurants-food');
    expect(merged.emirates).toEqual(['DUBAI']);
    expect(merged.minFollowers).toBe(20000);
  });
});

describe('social metric derivation', () => {
  it('derives averages only from returned data and never invents story views for TikTok', () => {
    const posts = [1, 2, 3].map((i) => ({ providerMediaId: `${i}`, mediaType: 'TIKTOK_VIDEO', views: 1000 * i, likes: 100, comments: 10, shares: 5 }));
    const m = deriveMetrics({ profile: { providerAccountId: 'x', username: 'x', followers: 5000 }, metrics: [], posts, audience: [], unavailable: [], apiVersion: 'v2' }, 'TIKTOK');
    expect(m.find((x) => x.type === 'AVG_VIDEO_VIEWS')).toEqual({ type: 'AVG_VIDEO_VIEWS', value: 2000, sampleSize: 3 });
    expect(m.find((x) => x.type === 'AVG_STORY_VIEWS')).toBeUndefined();
  });
});

describe('open-redirect protection', () => {
  it('only allows same-site relative paths', () => {
    expect(sanitizeRedirect('/business')).toBe('/business');
    expect(sanitizeRedirect('//evil.com')).toBeNull();
    expect(sanitizeRedirect('https://evil.com')).toBeNull();
    expect(sanitizeRedirect('/\\evil.com')).toBeNull();
  });
});
