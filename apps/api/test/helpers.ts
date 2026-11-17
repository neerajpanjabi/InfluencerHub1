import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { authenticator } from 'otplib';
import { randomUUID } from 'crypto';
import { CookieAccessInfo } from 'cookiejar';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/common/services/prisma.service';

let appPromise: Promise<NestExpressApplication> | null = null;
export async function getApp() {
  if (!appPromise) {
    appPromise = createApp().then(async (a) => {
      await a.init();
      return a;
    });
  }
  return appPromise;
}
export async function prisma() {
  return (await getApp()).get(PrismaService);
}

export const uid = () => randomUUID().slice(0, 8);
export const PASSWORD = 'TestPassw0rd!x';

/** Cookie-jar client that mirrors the browser: cookies + CSRF double-submit header. */
export class Client {
  agent: request.Agent;
  constructor(app: NestExpressApplication) {
    this.agent = request.agent(app.getHttpServer());
  }
  private csrf(): string {
    const jar = (this.agent as any).jar;
    const c = jar.getCookie('ih_csrf', CookieAccessInfo.All);
    return c?.value ?? '';
  }
  get(path: string) {
    return this.agent.get(`/api/v1${path}`);
  }
  post(path: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    const r = this.agent.post(`/api/v1${path}`);
    if (opts.csrf !== false) r.set('x-csrf-token', this.csrf());
    return body === undefined ? r : r.send(body as object);
  }
  patch(path: string, body?: unknown) {
    return this.agent.patch(`/api/v1${path}`).set('x-csrf-token', this.csrf()).send(body as object);
  }
  put(path: string, body?: unknown) {
    return this.agent.put(`/api/v1${path}`).set('x-csrf-token', this.csrf()).send((body ?? {}) as object);
  }
  delete(path: string) {
    return this.agent.delete(`/api/v1${path}`).set('x-csrf-token', this.csrf());
  }
}

export async function categoryIds(...slugs: string[]) {
  const db = await prisma();
  const rows = await db.category.findMany({ where: { slug: { in: slugs } } });
  return slugs.map((s) => rows.find((r) => r.slug === s)!.id);
}

export async function newBusiness(app: NestExpressApplication, overrides: Record<string, unknown> = {}) {
  const c = new Client(app);
  const email = `biz-${uid()}@test.local`;
  const [cat] = await categoryIds('medical-healthcare');
  const res = await c.post(
    '/auth/register/business',
    { businessName: `Biz ${uid()}`, contactPerson: 'Test Person', email, password: PASSWORD, phone: '0501234567', emirate: 'DUBAI', city: 'Dubai', categoryIds: [cat], acceptTerms: true, ...overrides },
    { csrf: false },
  );
  if (res.status !== 201) throw new Error(`business register failed ${res.status} ${JSON.stringify(res.body)}`);
  return { c, email, user: res.body };
}

/** Influencer with a sandbox-connected Instagram account, public profile and one active service. */
export async function newInfluencer(app: NestExpressApplication, opts: { price?: number; category?: string } = {}) {
  const c = new Client(app);
  const email = `inf-${uid()}@test.local`;
  const reg = await c.post('/auth/register/influencer', { fullName: 'Test Creator', displayName: `Creator ${uid()}`, email, password: PASSWORD, phone: '0559876543', emirate: 'DUBAI', city: 'Dubai', acceptTerms: true }, { csrf: false });
  if (reg.status !== 201) throw new Error(`influencer register failed ${reg.status} ${JSON.stringify(reg.body)}`);
  const [cat] = await categoryIds(opts.category ?? 'dermatology');
  const upd = await c.patch('/influencers/me/profile', { bio: 'Evidence-based skincare creator in Dubai.', categoryIds: [cat], isPublic: true, languages: ['en', 'ar'] });
  if (upd.status !== 200) throw new Error(`profile update failed ${JSON.stringify(upd.body)}`);
  const connect = await connectSandbox(c, 'instagram', `creator.${uid()}`);
  const svc = await c.post('/services/mine', { catalogKey: 'ig_reel', title: 'Instagram Reel', price: opts.price ?? 1000, deliveryDays: 5, revisions: 1, taxTreatment: 'STANDARD', status: 'ACTIVE' });
  if (svc.status !== 201) throw new Error(`service create failed ${JSON.stringify(svc.body)}`);
  return { c, email, user: reg.body, profileId: reg.body.influencerProfile.id as string, serviceId: svc.body.service.id as string, connect };
}

export async function connectSandbox(c: Client, platform: 'instagram' | 'tiktok', username: string) {
  const start = await c.post(`/social/${platform}/connect`, { mode: 'sandbox' });
  if (start.status !== 201) throw new Error(`connect start failed ${JSON.stringify(start.body)}`);
  const state = new URL(start.body.url).searchParams.get('state')!;
  const cb = await c.get(`/social/${platform}/callback?state=${encodeURIComponent(state)}&sandbox=1&username=${username}`);
  return { state, location: cb.headers.location as string };
}

/** Completes a sandbox hosted checkout the way a browser would (posts the provider form). */
export async function completeSandboxCheckout(c: Client, checkoutUrl: string, outcome: 'succeeded' | 'failed' = 'succeeded') {
  const sessionId = checkoutUrl.split('/').pop()!;
  return c.agent.post(`/api/v1/payments/sandbox/checkout/${sessionId}/complete`).type('form').send({ outcome });
}

export async function adminClient(app: NestExpressApplication) {
  const db = await prisma();
  const c = new Client(app);
  const email = `admin-${uid()}@test.local`;
  const argon2 = await import('argon2');
  const role = await db.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
  await db.user.create({ data: { email, passwordHash: await argon2.hash(PASSWORD), type: 'ADMIN', emailVerifiedAt: new Date(), roles: { create: { roleId: role.id } } } });
  const login = await c.post('/auth/login', { email, password: PASSWORD }, { csrf: false });
  if (!login.body.requiresTwoFactorSetup) throw new Error('expected 2FA setup');
  const setup = await c.post('/auth/2fa/setup');
  const enable = await c.post('/auth/2fa/enable', { code: authenticator.generate(setup.body.secret) });
  if (enable.status !== 201) throw new Error(`2fa enable failed ${JSON.stringify(enable.body)}`);
  return { c, email, secret: setup.body.secret as string };
}
