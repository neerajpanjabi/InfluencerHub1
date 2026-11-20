import { randomUUID } from 'crypto';
import request from 'supertest';
import { SandboxPaymentProvider } from '../../src/modules/payments/providers/sandbox.provider';
import { adminClient, Client, completeSandboxCheckout, getApp, newBusiness, newInfluencer, PASSWORD, prisma, uid } from '../helpers';

async function paidOrder() {
  const app = await getApp();
  const inf = await newInfluencer(app);
  const biz = await newBusiness(app);
  await biz.c.post('/cart/items', { type: 'SERVICE', id: inf.serviceId });
  const co = await biz.c.post('/checkout', { idempotencyKey: randomUUID() });
  await completeSandboxCheckout(biz.c, co.body.checkoutUrl);
  const order = (await biz.c.get(`/orders/${co.body.orderId}`)).body;
  return { inf, biz, order, checkoutUrl: co.body.checkoutUrl as string };
}

describe('Security', () => {
  it('requires authentication for private endpoints', async () => {
    const app = await getApp();
    const anon = new Client(app);
    for (const p of ['/auth/me', '/cart', '/orders', '/conversations', '/social/accounts', '/notifications']) {
      expect((await anon.get(p)).status).toBe(401);
    }
  });

  it('enforces CSRF double-submit on cookie-authenticated mutations', async () => {
    const app = await getApp();
    const { c } = await newBusiness(app);
    const noHeader = await c.agent.post('/api/v1/cart/items').send({ type: 'SERVICE', id: randomUUID() });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.code).toBe('CSRF_INVALID');
    const wrong = await c.agent.post('/api/v1/cart/items').set('x-csrf-token', 'forged').send({ type: 'SERVICE', id: randomUUID() });
    expect(wrong.body.code).toBe('CSRF_INVALID');
  });

  it('enforces user types and admin permissions (RBAC)', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    expect((await inf.c.get('/cart')).status).toBe(403); // influencer cannot use business cart
    const biz = await newBusiness(app);
    expect((await biz.c.get('/admin/dashboard')).status).toBe(403);
    expect((await biz.c.get('/social/accounts')).status).toBe(403);
    // Content moderator cannot touch finance
    const { authenticator } = await import('otplib');
    const argon2 = await import('argon2');
    const email = `mod-${uid()}@test.local`;
    const role = await db.role.findUniqueOrThrow({ where: { key: 'CONTENT_MODERATOR' } });
    await db.user.create({ data: { email, passwordHash: await argon2.hash(PASSWORD), type: 'ADMIN', roles: { create: { roleId: role.id } } } });
    const mod = new Client(app);
    await mod.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
    const s = await mod.post('/auth/2fa/setup');
    await mod.post('/auth/2fa/enable', { code: authenticator.generate(s.body.secret) });
    expect((await mod.get('/admin/moderation/reports')).status).toBe(200);
    const r = await mod.post('/admin/refunds', { orderItemId: randomUUID(), amount: 10, reason: 'nope' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('INSUFFICIENT_PERMISSION');
    expect((await mod.get('/admin/audit-logs')).status).toBe(403);
  });

  it('prevents IDOR and cross-business / cross-influencer data leakage', async () => {
    const app = await getApp();
    const { inf, biz, order } = await paidOrder();
    const otherBiz = await newBusiness(app);
    const otherInf = await newInfluencer(app);
    const campaignId = order.items[0].campaign.id;
    expect((await otherBiz.c.get(`/orders/${order.id}`)).status).toBe(404);
    expect((await otherBiz.c.get(`/invoices/${order.invoices[0].id}`)).status).toBe(404);
    expect((await otherBiz.c.get(`/campaigns/${campaignId}`)).status).toBe(404);
    expect((await otherInf.c.get(`/campaigns/${campaignId}`)).status).toBe(404);
    expect((await otherInf.c.post(`/campaigns/${campaignId}/transition`, { to: 'IN_PROGRESS' })).status).toBe(404);
    const conv = (await biz.c.get('/conversations')).body[0];
    expect((await otherBiz.c.get(`/conversations/${conv.id}/messages`)).status).toBe(404);
    expect((await otherBiz.c.post(`/conversations/${conv.id}/messages`, { body: 'hi' })).status).toBe(404);
    expect((await otherBiz.c.get('/orders')).body).toHaveLength(0);
    // creator cannot edit another creator's service
    expect((await otherInf.c.patch(`/services/mine/${inf.serviceId}`, { catalogKey: 'ig_reel', title: 'Hacked', price: 1, deliveryDays: 1, revisions: 0 })).status).toBe(404);
    // social accounts are owner-scoped
    const acc = (await inf.c.get('/social/accounts')).body.accounts[0];
    expect((await otherInf.c.delete(`/social/accounts/${acc.id}`)).status).toBe(404);
  });

  it('blocks messaging without a contact entitlement', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    const biz = await newBusiness(app);
    // Forge a conversation row directly (e.g. via a bug elsewhere) — API must still refuse
    const conv = await db.conversation.create({ data: { businessUserId: biz.user.id, influencerUserId: inf.user.id, participants: { create: [{ userId: biz.user.id }, { userId: inf.user.id }] } } });
    const r = await biz.c.post(`/conversations/${conv.id}/messages`, { body: 'Let us talk' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('CONTACT_ENTITLEMENT_REQUIRED');
    const q = await biz.c.post('/quotations', { influencerId: inf.profileId, brief: 'A long enough campaign brief for testing.' });
    expect(q.body.code).toBe('CONTACT_ENTITLEMENT_REQUIRED');
  });

  it('uses free contact allowance once, then requires payment', async () => {
    const app = await getApp();
    const a = await newInfluencer(app);
    const b = await newInfluencer(app);
    const biz = await newBusiness(app);
    const free = await biz.c.post(`/contact/${a.profileId}/unlock`, { useFreeCredit: true, idempotencyKey: randomUUID() });
    expect(free.body.status).toBe('UNLOCKED');
    const second = await biz.c.post(`/contact/${b.profileId}/unlock`, { useFreeCredit: true, idempotencyKey: randomUUID() });
    expect(second.body.code).toBe('NO_FREE_CONTACTS_LEFT');
  });

  it('rejects webhooks with invalid signatures and processes duplicate events once', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    const biz = await newBusiness(app);
    await biz.c.post('/cart/items', { type: 'SERVICE', id: inf.serviceId });
    const co = await biz.c.post('/checkout', { idempotencyKey: randomUUID() });
    const sessionId = co.body.checkoutUrl.split('/').pop();
    const payment = await db.payment.findFirstOrThrow({ where: { providerSessionId: sessionId } });
    const body = JSON.stringify({ id: `evt_${uid()}`, type: 'payment.succeeded', data: { sessionId, amount: Math.round(Number(payment.amount) * 100), currency: 'AED' } });
    const http = request(app.getHttpServer());

    const forged = await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', 't=1,v1=deadbeef').send(body);
    expect(forged.status).toBe(400);
    expect(forged.body.code).toBe('INVALID_SIGNATURE');
    const stale = await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body, Math.floor(Date.now() / 1000) - 3600)).send(body);
    expect(stale.body.code).toBe('INVALID_SIGNATURE'); // replay window
    const tampered = await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body)).send(body.replace('payment.succeeded', 'payment.failed'));
    expect(tampered.body.code).toBe('INVALID_SIGNATURE');
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');

    const ok = await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body)).send(body);
    expect(ok.status).toBe(200);
    const dup = await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body)).send(body);
    expect(dup.body.duplicate).toBe(true);
    // A different event id for the same payment must not double-fulfil
    const body2 = body.replace(/"id":"evt_[^"]+"/, `"id":"evt_${uid()}"`);
    await http.post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body2)).send(body2);
    expect(await db.commission.count({ where: { orderItem: { orderId: co.body.orderId } } })).toBe(1);
    expect(await db.invoice.count({ where: { orderId: co.body.orderId } })).toBe(1);
    expect(await db.financialLedger.count({ where: { referenceType: 'ORDER', referenceId: co.body.orderId } })).toBe(4);
  });

  it('rejects webhook amount mismatches', async () => {
    const app = await getApp();
    const db = await prisma();
    const inf = await newInfluencer(app);
    const biz = await newBusiness(app);
    await biz.c.post('/cart/items', { type: 'SERVICE', id: inf.serviceId });
    const co = await biz.c.post('/checkout', { idempotencyKey: randomUUID() });
    const sessionId = co.body.checkoutUrl.split('/').pop();
    const body = JSON.stringify({ id: `evt_${uid()}`, type: 'payment.succeeded', data: { sessionId, amount: 100, currency: 'AED' } });
    const r = await request(app.getHttpServer()).post('/api/v1/payments/webhooks/sandbox').set('content-type', 'application/json').set('x-sandbox-signature', SandboxPaymentProvider.sign(body)).send(body);
    expect(r.status).toBe(500);
    const order = await db.order.findUniqueOrThrow({ where: { id: co.body.orderId } });
    expect(order.status).toBe('PENDING_PAYMENT');
  });

  it('rate limits sensitive endpoints', async () => {
    const app = await getApp();
    const c = new Client(app);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await c.agent.post('/api/v1/auth/login').set('x-test-rate-limit', '1').send({ email: `x${i}@test.local`, password: 'WrongPassw0rd!' });
      statuses.push(r.status);
    }
    expect(statuses).toContain(429);
  });

  it('validates uploads by content, not by name or declared type', async () => {
    const app = await getApp();
    const { c } = await newBusiness(app);
    const csrf = () => ((c.agent as any).jar.getCookie('ih_csrf', require('cookiejar').CookieAccessInfo.All).value);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
    const ok = await c.agent.post('/api/v1/uploads').set('x-csrf-token', csrf()).field('purpose', 'LOGO').attach('file', png, { filename: 'logo.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    const html = await c.agent.post('/api/v1/uploads').set('x-csrf-token', csrf()).field('purpose', 'MESSAGE').attach('file', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'image.png', contentType: 'image/png' });
    expect(html.body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    const exe = await c.agent.post('/api/v1/uploads').set('x-csrf-token', csrf()).field('purpose', 'VERIFICATION').attach('file', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]), { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(exe.body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    const pdfJs = await c.agent.post('/api/v1/uploads').set('x-csrf-token', csrf()).field('purpose', 'VERIFICATION').attach('file', Buffer.from('%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>'), { filename: 'licence.pdf', contentType: 'application/pdf' });
    expect(pdfJs.body.code).toBe('FILE_REJECTED_ACTIVE_CONTENT');
    // Private uploads are not readable by other users
    const priv = await c.agent.post('/api/v1/uploads').set('x-csrf-token', csrf()).field('purpose', 'VERIFICATION').attach('file', Buffer.from('%PDF-1.7\nplain document content here'), { filename: 'licence.pdf' });
    const other = await newBusiness(app);
    expect((await other.c.get(`/uploads/${priv.body.id}`)).status).toBe(404);
    expect((await c.get(`/uploads/${priv.body.id}`)).status).toBe(200);
  });

  it('PostgreSQL RLS isolates conversations/messages and hides OAuth tokens in user context', async () => {
    const { biz, inf } = await paidOrder();
    const db = await prisma();
    const outsider = await newBusiness(await getApp());
    const seen = await db.withUserContext(outsider.user.id, (tx) => tx.conversation.count({ where: { influencerUserId: inf.user.id } }));
    expect(seen).toBe(0);
    const own = await db.withUserContext(biz.user.id, (tx) => tx.conversation.count({ where: { influencerUserId: inf.user.id } }));
    expect(own).toBe(1);
    const tokens = await db.withUserContext(inf.user.id, (tx) => tx.socialOAuthToken.count());
    expect(tokens).toBe(0);
  });

  it('records sensitive admin actions in an immutable audit log', async () => {
    const app = await getApp();
    const db = await prisma();
    const admin = await adminClient(app);
    const r = await admin.c.patch('/admin/settings/contact', { contactFee: '59.00' });
    expect(r.body.contactFee).toBe('59.00');
    await admin.c.patch('/admin/settings/contact', { contactFee: '49.00' });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: 'admin.settings.contact' }, orderBy: { createdAt: 'desc' } });
    await expect(db.$executeRawUnsafe(`DELETE FROM audit_logs WHERE id = '${log.id}'`)).rejects.toThrow(/append-only/);
    const unknownKey = await admin.c.patch('/admin/settings/contact', { contactFee: '1', evil: true });
    expect(unknownKey.status).toBe(400);
  });
});
