import { randomUUID } from 'crypto';
import { adminClient, completeSandboxCheckout, connectSandbox, getApp, newBusiness, newInfluencer, prisma, uid } from '../helpers';

describe('Marketplace end-to-end (sandbox providers)', () => {
  it('social connection: OAuth round trip, encrypted tokens, sandbox-labelled snapshots, grade computed', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    expect(inf.connect.location).toContain('connected=instagram');
    const accounts = await inf.c.get('/social/accounts');
    expect(accounts.status).toBe(200);
    const acc = accounts.body.accounts[0];
    expect(acc.platform).toBe('INSTAGRAM');
    expect(acc.isSandbox).toBe(true);
    expect(acc.status).toBe('CONNECTED');
    expect(JSON.stringify(accounts.body)).not.toMatch(/accessToken|sbx_at_/); // tokens never exposed
    const token = await db.socialOAuthToken.findFirstOrThrow({ where: { socialAccountId: acc.id } });
    expect(token.accessTokenEnc.startsWith('v1.')).toBe(true); // AES-GCM envelope
    expect(token.accessTokenEnc).not.toContain('sbx_at_');
    const metrics = acc.metrics.map((m: any) => m.metricType);
    expect(metrics).toEqual(expect.arrayContaining(['FOLLOWERS', 'AVG_REEL_VIEWS', 'AVG_STORY_VIEWS', 'ENGAGEMENT_RATE']));
    expect(acc.metrics.every((m: any) => m.source === 'SANDBOX' && m.collectedAt)).toBe(true);
    const grade = await inf.c.get('/influencers/me/grade');
    expect(grade.body.current.grade).toBeDefined();
    expect(grade.body.current.breakdown.components).toHaveLength(6);
  });

  it('rejects OAuth callbacks with invalid, replayed or foreign state', async () => {
    const app = await getApp();
    const inf = await newInfluencer(app);
    const bad = await inf.c.get('/social/instagram/callback?state=invalid-state-value-1234567890&sandbox=1&username=x.y');
    expect(bad.headers.location).toContain('error=oauth_state_invalid');
    const replay = await inf.c.get(`/social/instagram/callback?state=${encodeURIComponent(inf.connect.state)}&sandbox=1&username=x.y`);
    expect(replay.headers.location).toContain('error=oauth_state_invalid');
    // State started by creator A cannot be completed in creator B's session
    const other = await newInfluencer(app);
    const start = await inf.c.post('/social/tiktok/connect', { mode: 'sandbox' });
    const state = new URL(start.body.url).searchParams.get('state')!;
    const hijack = await other.c.get(`/social/tiktok/callback?state=${encodeURIComponent(state)}&sandbox=1&username=hijack.me`);
    expect(hijack.headers.location).toContain('error=oauth_session_mismatch');
  });

  it('prevents one platform account being linked to two creators', async () => {
    const app = await getApp();
    const a = await newInfluencer(app);
    const b = await newInfluencer(app);
    const name = `shared.${uid()}`;
    await connectSandbox(a.c, 'tiktok', name);
    const r = await connectSandbox(b.c, 'tiktok', name);
    expect(r.location).toContain('error=social_account_linked_elsewhere');
  });

  it('disconnect destroys tokens and keeps history', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    const acc = (await inf.c.get('/social/accounts')).body.accounts[0];
    const del = await inf.c.delete(`/social/accounts/${acc.id}`);
    expect(del.status).toBe(200);
    const tokens = await db.socialOAuthToken.findMany({ where: { socialAccountId: acc.id } });
    expect(tokens.every((t) => t.revokedAt && t.accessTokenEnc === 'revoked')).toBe(true);
    expect(await db.socialMetricSnapshot.count({ where: { socialAccountId: acc.id } })).toBeGreaterThan(0);
    const grade = await inf.c.get('/influencers/me/grade');
    expect(grade.body.current.grade).toBe('NOT_RATED');
  });

  it('full flow: browse → paid contact → message → quotation → cart → checkout → webhook → campaign → review → refund → payout', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app, { price: 1000 });
    const biz = await newBusiness(app);

    // Browse publicly without paying
    const list = await biz.c.get('/influencers?category=dermatology&emirate=DUBAI&pageSize=60');
    expect(list.status).toBe(200);
    const slug = (await db.influencerProfile.findUniqueOrThrow({ where: { id: inf.profileId } })).slug;
    const profile = await biz.c.get(`/influencers/${slug}`);
    expect(profile.status).toBe(200);
    expect(profile.body.services[0].price).toBe('1000');
    expect(profile.body.viewer.canContact).toBe(false);
    expect(profile.body).not.toHaveProperty('phone');
    expect(profile.body).not.toHaveProperty('fullName');

    // Save
    expect((await biz.c.put(`/saved/${inf.profileId}`)).body.saved).toBe(true);

    // Messaging is blocked before contact is unlocked
    const status = await biz.c.get(`/contact/${inf.profileId}`);
    expect(status.body.reason).toBe('PAYMENT_REQUIRED');
    expect(status.body.total).toBe('51.45'); // 49.00 + 5% VAT

    // Paid contact via sandbox gateway
    const unlock = await biz.c.post(`/contact/${inf.profileId}/unlock`, { idempotencyKey: randomUUID() });
    expect(unlock.body.status).toBe('PAYMENT_REQUIRED');
    const again = await biz.c.post(`/contact/${inf.profileId}/unlock`, { idempotencyKey: randomUUID() });
    expect(again.body.paymentId).toBe(unlock.body.paymentId); // pending purchase reused — no duplicate charge
    const done = await completeSandboxCheckout(biz.c, unlock.body.checkoutUrl);
    expect(done.status).toBe(302);
    const after = await biz.c.post(`/contact/${inf.profileId}/unlock`, { idempotencyKey: randomUUID() });
    expect(after.body.status).toBe('ALREADY_UNLOCKED');
    const purchases = await db.contactPurchase.count({ where: { influencerId: inf.profileId, status: 'SUCCEEDED' } });
    expect(purchases).toBe(1);

    // Messaging works now; contact details are blocked before booking
    const conv = (await biz.c.get('/conversations')).body[0];
    expect((await biz.c.post(`/conversations/${conv.id}/messages`, { body: 'Hello! Interested in a Reel for our clinic.' })).status).toBe(201);
    const leak = await biz.c.post(`/conversations/${conv.id}/messages`, { body: 'Call me on 050 123 4567' });
    expect(leak.body.code).toBe('CONTACT_DETAILS_NOT_ALLOWED');
    const infMsgs = await inf.c.get(`/conversations/${conv.id}/messages`);
    expect(infMsgs.body.messages).toHaveLength(1);
    expect(infMsgs.body.messages[0].mine).toBe(false);

    // Quotation
    const q = await biz.c.post('/quotations', { influencerId: inf.profileId, brief: 'Launch campaign for our new dermatology clinic in Dubai Marina.', requestedBudget: 3000 });
    expect(q.status).toBe(201);
    const sub = await inf.c.post(`/quotations/${q.body.id}/submit`, { items: [{ description: 'Reel + 3 Stories', platform: 'INSTAGRAM', quantity: 1, unitPrice: 2500, deliveryDays: 7 }], validDays: 7 });
    expect(sub.body.status).toBe('SUBMITTED');
    const acc = await biz.c.post(`/quotations/${q.body.id}/accept`);
    expect(acc.status).toBe(201);

    // Cart: quotation + catalogue service
    const cart = await biz.c.post('/cart/items', { type: 'SERVICE', id: inf.serviceId, quantity: 1, brief: 'Clinic tour reel' });
    expect(cart.body.summary.lines).toHaveLength(2);
    // Default commission: 15% paid by influencer; VAT 5% on what the business pays
    expect(cart.body.summary.subtotal).toBe('3500.00');
    expect(cart.body.summary.vat).toBe('175.00');
    expect(cart.body.summary.total).toBe('3675.00');

    const key = randomUUID();
    const co = await biz.c.post('/checkout', { idempotencyKey: key, campaignTitle: 'Clinic launch' });
    expect(co.status).toBe(201);
    const co2 = await biz.c.post('/checkout', { idempotencyKey: key });
    expect(co2.body.orderId).toBe(co.body.orderId); // idempotent
    expect(await db.order.count({ where: { idempotencyKey: { endsWith: key } } })).toBe(1);

    await completeSandboxCheckout(biz.c, co.body.checkoutUrl);
    const order = await biz.c.get(`/orders/${co.body.orderId}`);
    expect(order.body.status).toBe('PAID');
    expect(order.body.invoices).toHaveLength(1);
    expect(order.body.items.every((i: any) => i.campaign.status === 'CONFIRMED')).toBe(true);

    // Ledger is balanced and immutable
    const ledger = await db.financialLedger.findMany({ where: { referenceId: co.body.orderId } });
    const debit = ledger.filter((l) => l.direction === 'DEBIT').reduce((a, l) => a + Number(l.amount), 0);
    const credit = ledger.filter((l) => l.direction === 'CREDIT').reduce((a, l) => a + Number(l.amount), 0);
    expect(debit).toBeCloseTo(3675, 2);
    expect(credit).toBeCloseTo(3675, 2);
    const commission = ledger.filter((l) => l.account === 'PLATFORM_COMMISSION_REVENUE').reduce((a, l) => a + Number(l.amount), 0);
    expect(commission).toBeCloseTo(525, 2); // 15% of 3500
    await expect(db.$executeRawUnsafe(`UPDATE financial_ledger SET amount = 1 WHERE id = '${ledger[0].id}'`)).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe(`DELETE FROM financial_ledger WHERE id = '${ledger[0].id}'`)).rejects.toThrow(/append-only/);

    // Campaign lifecycle on the catalogue item
    const campaignId = order.body.items.find((i: any) => i.description === 'Instagram Reel').campaign.id;
    const wrongActor = await biz.c.post(`/campaigns/${campaignId}/transition`, { to: 'IN_PROGRESS' });
    expect(wrongActor.body.code).toBe('INVALID_TRANSITION');
    expect((await inf.c.post(`/campaigns/${campaignId}/transition`, { to: 'IN_PROGRESS' })).body.status).toBe('IN_PROGRESS');
    let camp = (await inf.c.get(`/campaigns/${campaignId}`)).body;
    const d = camp.deliverables[0];
    camp = (await inf.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/submit`, { draftUrl: 'https://example.com/draft.mp4', draftNotes: 'v1' })).body;
    expect(['CONTENT_SUBMITTED', 'AWAITING_APPROVAL']).toContain(camp.status);
    camp = (await biz.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/review`, { decision: 'REVISION_REQUESTED', comment: 'Mention the location' })).body;
    expect(camp.status).toBe('REVISION_REQUESTED');
    const second = await biz.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/review`, { decision: 'REVISION_REQUESTED' });
    expect(second.body.code).toBe('DELIVERABLE_NOT_SUBMITTED');
    await inf.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/submit`, { draftUrl: 'https://example.com/draft2.mp4' });
    camp = (await biz.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/review`, { decision: 'APPROVED' })).body;
    expect(camp.status).toBe('APPROVED');
    // Medical category → compliance review gate before publishing
    const blocked = await inf.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/publish`, { publishedUrl: 'https://instagram.com/p/xyz' });
    expect(blocked.body.code).toBe('COMPLIANCE_REVIEW_PENDING');
    const admin = await adminClient(app);
    expect((await admin.c.post(`/admin/campaigns/${campaignId}/compliance`, { status: 'APPROVED', notes: 'DHA permit verified' })).status).toBe(201);
    camp = (await inf.c.post(`/campaigns/${campaignId}/deliverables/${d.id}/publish`, { publishedUrl: 'https://instagram.com/p/xyz' })).body;
    expect(camp.status).toBe('PUBLISHED');
    camp = (await biz.c.post(`/campaigns/${campaignId}/transition`, { to: 'COMPLETED' })).body;
    expect(camp.status).toBe('COMPLETED');
    const review = await biz.c.post(`/campaigns/${campaignId}/review`, { rating: 5, comment: 'Excellent' });
    expect(review.status).toBe(201);
    expect((await biz.c.post(`/campaigns/${campaignId}/review`, { rating: 4 })).status).toBe(409);

    // Earnings: commission released at completion (payout hold applies)
    const earnings = await inf.c.get('/finance/earnings');
    expect(Number(earnings.body.pending) + Number(earnings.body.available)).toBeCloseTo(850 + 2125, 2);

    // Partial refund of the quotation line by Finance (admin)
    const quoteItem = order.body.items.find((i: any) => i.quotationId);
    const refund = await admin.c.post('/admin/refunds', { orderItemId: quoteItem.id, amount: 1312.5, reason: 'Scope reduced' });
    expect(refund.status).toBe(201);
    expect(refund.body.status).toBe('SUCCEEDED');
    const over = await admin.c.post('/admin/refunds', { orderItemId: quoteItem.id, amount: 5000, reason: 'Too much' });
    expect(over.body.code).toBe('REFUND_EXCEEDS_REFUNDABLE');
    expect((await biz.c.get(`/orders/${co.body.orderId}`)).body.status).toBe('PARTIALLY_REFUNDED');
    const refundLedger = await db.financialLedger.findMany({ where: { referenceType: 'REFUND', referenceId: refund.body.id } });
    const rd = refundLedger.filter((l) => l.direction === 'DEBIT').reduce((a, l) => a + Number(l.amount), 0);
    expect(rd).toBeCloseTo(1312.5, 2);

    // Payout: make commission eligible (simulate hold elapsed) then batch + mark paid
    await db.commission.updateMany({ where: { influencerId: inf.profileId }, data: { releasedAt: new Date(Date.now() - 30 * 86_400_000) } });
    const batch = await admin.c.post('/admin/payouts/batch');
    const payout = batch.body.find((p: any) => p.influencerId === inf.profileId);
    expect(payout).toBeDefined();
    expect((await admin.c.post(`/admin/payouts/${payout.id}/paid`, { reference: 'BANK-REF-001' })).body.status).toBe('PAID');

    // Revenue report is ledger-derived and separates contact fees from commission
    const report = await admin.c.get('/admin/reports/revenue?groupBy=month');
    const totals = report.body.reduce((a: any, r: any) => ({ c: a.c + r.commissionRevenue, f: a.f + r.contactFeeRevenue }), { c: 0, f: 0 });
    expect(totals.c).toBeGreaterThan(0);
    expect(totals.f).toBeGreaterThan(0);
  });

  it('AI recommendations use real records and explain matches', async () => {
    const app = await getApp();
    const inf = await newInfluencer(app, { category: 'dermatology' });
    const biz = await newBusiness(app);
    const r = await biz.c.post('/ai/recommendations', { query: 'Find 50 Dubai-based dermatologists for a clinic promotion' });
    expect(r.status).toBe(201);
    expect(r.body.parser).toBe('RULES');
    expect(r.body.understood.specialities).toContain('dermatology');
    const hit = r.body.results.find((x: any) => x.influencer.id === inf.profileId);
    expect(hit).toBeDefined();
    expect(hit.reasons.map((x: any) => x.code)).toEqual(expect.arrayContaining(['SPECIALITY_MATCH', 'LOCATION_MATCH']));
    const fb = await biz.c.post('/ai/feedback', { recommendationId: hit.recommendationId, helpful: true });
    expect(fb.status).toBe(201);
    // Refinement keeps prior intent
    const refined = await biz.c.post('/ai/recommendations', { query: 'only on tiktok', previous: r.body.understood });
    expect(refined.body.understood.specialities).toContain('dermatology');
    expect(refined.body.understood.platforms).toEqual(['TIKTOK']);
    // Arabic
    const ar = await biz.c.post('/ai/recommendations', { query: 'أطباء جلدية في دبي', locale: 'ar' });
    expect(ar.body.understood.emirates).toContain('DUBAI');
  });
});
