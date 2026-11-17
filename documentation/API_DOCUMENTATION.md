# InfluenceHub — API documentation

Base URL: `https://<domain>/api/v1` (browser, via same-origin proxy) or `http://api:4000/api/v1` (internal).
Interactive OpenAPI/Swagger UI: **`/api/docs`** (non-production environments).

## Conventions
* JSON; money values are decimal **strings** in AED (e.g. `"1050.00"`).
* Auth: cookies `ih_at` (access JWT, 15 min) + `ih_rt` (refresh, path `/api/v1/auth`) + `ih_csrf`. Unsafe requests authenticated by cookie must send `x-csrf-token: <ih_csrf value>`. Server-to-server clients may use `Authorization: Bearer <access token>` (no CSRF needed).
* Errors: `{ "code": "MACHINE_CODE", "statusCode": 400, ... }` — validation errors include `issues[]`. Codes are translated client-side (`errors.*`).
* Rate limits: global 300/min/IP; tighter on auth, uploads, AI, checkout, contact unlock. `429` on excess.
* Idempotency: `POST /checkout` and `POST /contact/:id/unlock` require a client-generated UUID `idempotencyKey`.

## Endpoints

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register/business` | public | `businessRegistrationSchema` |
| POST | `/auth/register/influencer` | public | `influencerRegistrationSchema` |
| POST | `/auth/login` | public | `{email,password,totp?}` → profile + `requiresTwoFactorSetup` |
| POST | `/auth/refresh` · `/auth/logout` | cookie | rotation + reuse detection |
| GET | `/auth/me` | user | |
| POST | `/auth/locale` | user | `{locale:'en'|'ar'}` |
| POST | `/auth/verify-email` · `/auth/verify-email/resend` | public / user | |
| POST | `/auth/password/forgot` · `/auth/password/reset` · `/auth/password/change` | | |
| POST | `/auth/phone/send-otp` · `/auth/phone/verify` | user | |
| POST | `/auth/2fa/setup` · `/auth/2fa/enable` | admin | mandatory for admins |
| GET | `/auth/providers` | public | which OAuth providers are configured |
| GET | `/auth/google/start` · `/auth/google/callback` | public | OIDC + PKCE |

### Social (creators)
| GET | `/social/accounts` | creator | accounts, latest metrics (with source/verification), permissions, sync logs |
| POST | `/social/:platform/connect` | creator | `{mode?:'sandbox'}` → `{url}` |
| GET | `/social/:platform/login` | public | creator sign-in with Instagram/TikTok |
| GET | `/social/:platform/callback` | public | OAuth callback (state + session checks) |
| POST | `/social/accounts/:id/sync` | creator | queued, max once / 10 min |
| DELETE | `/social/accounts/:id` | creator | revoke + destroy tokens |
| GET | `/social/accounts/:id/history?metric=` | creator | snapshot history |
| POST | `/social/metrics/manual` | creator | self-reported (pending review) |

### Marketplace
| GET | `/categories`, `/categories/:slug` | public | tree with counts |
| GET | `/influencers` | public | filters: `q, platform, category, emirate, city, language, gender, grade, minFollowers, maxFollowers, minReelViews, minStoryViews, minVideoViews, minEngagement, minPrice, maxPrice, serviceType, audienceLocation, verifiedOnly, medicalVerifiedOnly, availableOnly, sort, page, pageSize` |
| GET | `/influencers/home` | public | featured / top-rated / trending / popular services |
| GET | `/influencers/:slug` | public | profile, metrics per account, performance breakdown, services, packages, reviews, viewer state |
| GET/PATCH | `/influencers/me/profile` | creator | |
| GET | `/influencers/me/dashboard`, `/influencers/me/grade` | creator | |
| POST | `/influencers/me/grade/recompute` | creator | |
| POST/DELETE | `/influencers/me/availability[/:id]` | creator | |
| POST | `/influencers/me/medical-credentials`, `/influencers/me/verification/identity` | creator | |
| GET/PATCH | `/businesses/me` · GET `/businesses/me/dashboard` · POST `/businesses/me/verification` | business | |
| GET/PUT/DELETE | `/saved[/:influencerId]` | business | |
| GET | `/services/catalog` | public | |
| GET/POST/PATCH/DELETE | `/services/mine[/:id]` | creator | price history kept |
| GET | `/services/suggestion?catalogKey=&usageRightsMonths=&exclusivityMonths=` | creator | advisory, labelled sample/benchmark |
| GET/POST/DELETE | `/services/packages[/:id]` | creator | |

### Commerce & payments
| GET | `/contact/:influencerId` | business | entitlement decision + fee incl. VAT |
| POST | `/contact/:influencerId/unlock` | business | `{idempotencyKey, useFreeCredit?}` |
| GET | `/contact-access` | business | |
| GET | `/cart?discountCode=` | business | server-priced summary |
| POST/PATCH/DELETE | `/cart/items[/:id]` | business | `{type:'SERVICE'|'PACKAGE'|'QUOTATION', id, quantity, addOnKeys, brief}` |
| POST | `/checkout` | business | `{idempotencyKey, discountCode?, campaignTitle?}` → `{orderId, checkoutUrl}` |
| GET | `/orders`, `/orders/:id` · POST `/orders/:id/pay` | business | |
| GET | `/billing`, `/invoices/:id` | business | |
| POST | `/payments/webhooks/:provider` | signature | `sandbox`, `stripe` |
| GET | `/finance/earnings` | creator | pending/available/paid, commissions, payouts |

### Quotations, campaigns, messaging
| GET/POST | `/quotations` · GET `/quotations/:id` | business/creator | requesting needs contact entitlement |
| POST | `/quotations/:id/submit` · `/accept` · `/reject` | | accept adds to cart |
| GET | `/campaigns`, `/campaigns/:id` | parties | `allowedTransitions` per viewer |
| PATCH | `/campaigns/:id/brief` | business | |
| POST | `/campaigns/:id/transition` | parties | FSM-validated |
| POST | `/campaigns/:id/deliverables/:did/submit` · `/review` · `/publish` | | |
| POST | `/campaigns/:id/review` · `/campaigns/:id/dispute` · `/campaigns/reviews/:rid/respond` | | |
| GET | `/conversations` · `/conversations/:id/messages` | parties | RLS-scoped |
| POST | `/conversations/:id/messages` · `/block` · `/unblock` · `/conversations/reports` | | entitlement enforced |
| POST/GET | `/uploads`, `/uploads/:id` | user / authorised | multipart `file` + `purpose` |
| GET/POST | `/notifications`, `/notifications/unread-count`, `/notifications/read`, `/notifications/preferences` | user | |
| GET/POST | `/privacy/consents`, `/privacy/export`, `/privacy/deletion` | user | |

### AI
| POST | `/ai/recommendations` | public (logged when signed in) | `{query, previous?, locale}` → understood filters, ranked results with reason codes, relaxed constraints, suggestions |
| POST | `/ai/feedback` | business | `{recommendationId, helpful}` |

### Admin (permission in brackets; all require completed 2FA)
`GET /admin/dashboard` [reports.read] · `GET /admin/users` [users.read] · `POST /admin/users/:id/status` [users.manage] · `POST /admin/users/:id/roles`, `POST /admin/admins` [admins.manage] · `POST /admin/businesses/:id/contact-credits`, `POST /admin/contact-access` [contact_fees.manage] · `PATCH /admin/influencers/:id/flags` [users.manage] · `GET /admin/verifications` · `POST /admin/verifications/:id/decide` [influencers.verify] · `PUT /admin/categories` [categories.manage] · `PUT /admin/catalog` [services.manage] · `GET/PUT/DELETE /admin/benchmarks` [benchmarks.manage] · `GET/POST /admin/grading` [grading.manage] · `GET /admin/settings/:key` · `PATCH /admin/settings/{contact|commission|vat|pricing|platform|ai|messaging}` · `GET /admin/orders`, `/admin/campaigns` [bookings.read] · `POST /admin/campaigns/:id/compliance|transition` [campaigns.manage] · `GET /admin/payments`, `/admin/ledger`, `POST /admin/reports/reconcile` [payments.read] · `GET/POST /admin/refunds` [refunds.manage] · `GET /admin/payouts`, `POST /admin/payouts/batch|:id/paid|:id/status` [payouts.manage] · `GET /admin/reports/revenue`, `/admin/reports/breakdown/:dimension` [reports.read] · `GET /admin/disputes`, `POST /admin/disputes/:id/resolve` [disputes.manage] · `GET /admin/moderation/*`, `POST /admin/moderation/reports/:id` [moderation.manage] · `GET /admin/ai/quality|logs` [ai.manage] · `GET /admin/audit-logs` [audit.read] · `GET/PATCH /admin/integrations` [integrations.manage] · `GET /admin/privacy/deletions`, `POST …/:id/process` [users.manage]

### Health
`GET /health/live` · `GET /health/ready` (DB + Redis)
