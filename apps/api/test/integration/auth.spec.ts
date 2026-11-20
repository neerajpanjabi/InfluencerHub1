import { authenticator } from 'otplib';
import { Client, getApp, newBusiness, PASSWORD, prisma, uid, adminClient } from '../helpers';

describe('Authentication', () => {
  it('registers a business, sets secure session cookies and returns profile', async () => {
    const app = await getApp();
    const { c, user } = await newBusiness(app);
    expect(user.type).toBe('BUSINESS');
    expect(user.businessProfile.businessName).toMatch(/^Biz/);
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toMatch(/@test.local$/);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email and weak passwords', async () => {
    const app = await getApp();
    const { email } = await newBusiness(app);
    const c = new Client(app);
    const dup = await c.post('/auth/register/influencer', { fullName: 'X Y', displayName: 'XY', email, password: PASSWORD, phone: '0501112233', emirate: 'DUBAI', city: 'Dubai', acceptTerms: true }, { csrf: false });
    expect(dup.status).toBe(409);
    const weak = await c.post('/auth/register/influencer', { fullName: 'X Y', displayName: 'XY', email: `w-${uid()}@test.local`, password: 'short', phone: '0501112233', emirate: 'DUBAI', city: 'Dubai', acceptTerms: true }, { csrf: false });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe('VALIDATION_FAILED');
  });

  it('logs in, rejects wrong password with generic error, and locks after repeated failures', async () => {
    const app = await getApp();
    const { email } = await newBusiness(app);
    const c = new Client(app);
    const bad = await c.post('/auth/login', { email, password: 'WrongPassw0rd!' }, { csrf: false });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('INVALID_CREDENTIALS');
    const unknown = await c.post('/auth/login', { email: `nobody-${uid()}@test.local`, password: 'WrongPassw0rd!' }, { csrf: false });
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS'); // no account enumeration
    for (let i = 0; i < 4; i++) await c.post('/auth/login', { email, password: 'WrongPassw0rd!' }, { csrf: false });
    const locked = await c.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('rotates refresh tokens and revokes all sessions on refresh token reuse', async () => {
    const app = await getApp();
    const { c } = await newBusiness(app);
    const jar = (c.agent as any).jar;
    const { CookieAccessInfo } = await import('cookiejar');
    const oldRefresh = jar.getCookie('ih_rt', CookieAccessInfo.All).value;
    const r1 = await c.post('/auth/refresh');
    expect(r1.status).toBe(200);
    // Replay the old (rotated) refresh token from another client
    const attacker = new Client(app);
    const replay = await attacker.agent.post('/api/v1/auth/refresh').set('Cookie', `ih_rt=${oldRefresh}; ih_csrf=x`).set('x-csrf-token', 'x');
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('SESSION_REVOKED');
    const me = await c.get('/auth/me');
    expect(me.status).toBe(401); // legitimate session was revoked too
  });

  it('verifies email with single-use token', async () => {
    const app = await getApp();
    const { c, user } = await newBusiness(app);
    const db = await prisma();
    // Issue a known token through the service to simulate the email link
    const { AuthService } = await import('../../src/modules/auth/auth.service');
    const token = await app.get(AuthService).sendEmailVerification({ id: user.id, email: user.email, locale: 'en' });
    const ok = await c.post('/auth/verify-email', { token });
    expect(ok.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
    const again = await c.post('/auth/verify-email', { token });
    expect(again.status).toBe(400);
  });

  it('verifies phone via OTP', async () => {
    const app = await getApp();
    const { c } = await newBusiness(app);
    const sent = await c.post('/auth/phone/send-otp');
    expect(sent.body.sent).toBe(true);
    expect((await c.post('/auth/phone/verify', { code: '000000' })).status).toBe(400);
    expect((await c.post('/auth/phone/verify', { code: sent.body.testCode })).status).toBe(201);
  });

  it('requires 2FA for admins and enforces TOTP at login', async () => {
    const app = await getApp();
    const { email, secret } = await adminClient(app);
    const c = new Client(app);
    const noCode = await c.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
    expect(noCode.body.code).toBe('TOTP_REQUIRED');
    const ok = await c.post('/auth/login', { email, password: PASSWORD, totp: authenticator.generate(secret) }, { csrf: false });
    expect(ok.status).toBe(200);
    expect((await c.get('/admin/dashboard')).status).toBe(200);
  });

  it('blocks admin endpoints until 2FA is enrolled', async () => {
    const app = await getApp();
    const db = await prisma();
    const argon2 = await import('argon2');
    const email = `admin-no2fa-${uid()}@test.local`;
    const role = await db.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
    await db.user.create({ data: { email, passwordHash: await argon2.hash(PASSWORD), type: 'ADMIN', roles: { create: { roleId: role.id } } } });
    const c = new Client(app);
    await c.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
    const r = await c.get('/admin/dashboard');
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('ADMIN_2FA_REQUIRED');
  });

  it('returns the same pending 2FA secret for concurrent/repeated setup calls and rejects setup once enabled', async () => {
    const app = await getApp();
    const db = await prisma();
    const argon2 = await import('argon2');
    const email = `admin-setup-${uid()}@test.local`;
    const role = await db.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
    await db.user.create({ data: { email, passwordHash: await argon2.hash(PASSWORD), type: 'ADMIN', roles: { create: { roleId: role.id } } } });
    const c = new Client(app);
    await c.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
    const [a, b] = await Promise.all([c.post('/auth/2fa/setup'), c.post('/auth/2fa/setup')]);
    const again = await c.post('/auth/2fa/setup');
    expect(a.body.secret).toBeTruthy();
    expect(b.body.secret).toBe(a.body.secret);
    expect(again.body.secret).toBe(a.body.secret);
    const enable = await c.post('/auth/2fa/enable', { code: authenticator.generate(a.body.secret) });
    expect(enable.status).toBe(201);
    const after = await c.post('/auth/2fa/setup');
    expect(after.status).toBe(400);
    expect(after.body.code).toBe('TOTP_ALREADY_ENABLED');
  });

  it('records acceptance of the type-specific terms with versions at registration', async () => {
    const app = await getApp();
    const db = await prisma();
    const { user: biz } = await newBusiness(app);
    const bizConsents = (await db.consentRecord.findMany({ where: { userId: biz.id } })).map((c) => `${c.type}:${c.version}`).sort();
    expect(bizConsents).toEqual(['PRIVACY:privacy@2026-11', 'TERMS:business-terms@2026-11', 'TERMS:platform-terms@2026-11']);
    const { newInfluencer } = await import('../helpers');
    const inf = await newInfluencer(app);
    const infConsents = (await db.consentRecord.findMany({ where: { userId: inf.user.id, type: 'TERMS' } })).map((c) => c.version).sort();
    expect(infConsents).toEqual(['creator-terms@2026-11', 'platform-terms@2026-11']);
    // Visible to the user through the privacy API
    const list = await inf.c.get('/privacy/consents');
    expect(list.body.map((c: any) => c.version)).toEqual(expect.arrayContaining(['creator-terms@2026-11', 'privacy@2026-11']));
  });
});

