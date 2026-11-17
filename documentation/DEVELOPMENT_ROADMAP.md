# InfluenceHub — Development roadmap & checklist

Legend: ✅ implemented **and covered by passing automated tests** · 🟢 implemented, verified manually / by build · 🟡 implemented, needs external credentials/approval to go live · ⬜ not started / future

## Phase 1 — Foundation
- ✅ Monorepo (pnpm workspaces): apps/web, apps/api, apps/worker, packages/{database,shared,localization,ui,config}
- ✅ PostgreSQL schema (75+ entities incl. all required tables), 3 migrations, constraints, triggers, RLS
- ✅ Seed: RBAC, categories (20 + 21 medical specialities), service catalogue (30), settings, grading v1, SAMPLE benchmarks, super-admin, optional demo data
- ✅ Shared domain library with 55 unit tests (money, VAT, commission, grading, pricing, entitlements, FSM, RBAC, search schema, AI parser, UAE validation)
- ✅ Redis + BullMQ queues; inline mode for tests
- ✅ Authentication (email/password, sessions, refresh rotation, CSRF, lockout, email/phone verification, password reset, admin TOTP)
- 🟢 Design system (navy / ivory / champagne gold tokens, typography, components)
- ✅ Localization (EN/AR, 1,041 keys, parity check), RTL layouts

## Phase 2 — User portals
- ✅ Business registration + onboarding preferences (E2E)
- ✅ Creator registration + onboarding profile (E2E)
- 🟢 Profile management (business & creator, visibility controls, availability, verification requests)
- ✅ Admin authentication with mandatory 2FA
- 🟢 Business dashboard (15 sections), Creator studio (18 sections), Admin console (23 modules)

## Phase 3 — Marketplace
- ✅ Public profiles (visibility-aware, no private data), search, 18 filters, 8 sort orders, pagination
- ✅ Service catalogue, rate cards, packages, promotional & minimum prices, price history
- ✅ Saved creators

## Phase 4 — Social integrations
- 🟡 Instagram API with Instagram Login adapter (OAuth, token exchange/refresh, profile, media, insights, stories, demographics) — awaiting Meta App Review
- 🟡 TikTok Login Kit + Display API adapter (state + PKCE, refresh, revoke, user info, video list) — awaiting TikTok approval
- ✅ OAuth state/PKCE store, session binding, encrypted tokens, permissions tracking, disconnect & revoke
- ✅ Sandbox adapter (labelled), sync worker, append-only snapshots, sync logs, manual metric submission
- ✅ Verification indicators (source + status + timestamps on every metric)

## Phase 5 — Grading & pricing
- ✅ Scoring engine (weights 25/20/15/15/15/10, grades S–D, Not Yet Rated, normalisation, category scaling, freshness, min samples, outliers, verified weighting, explainable breakdown, history)
- ✅ Admin-configurable, versioned grading rules with bulk recompute
- ✅ Pricing recommendation engine (benchmark match → formula fallback, 12 factors) labelled advisory/sample
- ✅ Editable UAE benchmark database (sample rows flagged)

## Phase 6 — E-commerce
- ✅ Multi-creator cart, quotations as cart items, discounts, server-side pricing
- ✅ Paid contact, free allowance, admin grants, duplicate-charge prevention
- ✅ Idempotent checkout, hosted payment (sandbox), signed webhooks, invoices
- ✅ Commission (default/category/service, payer business/creator/split, min/max)
- ✅ VAT (5% configurable, treatments), immutable double-entry ledger
- ✅ Refunds with proportional reversals; payouts with hold period
- 🟡 Stripe adapter (needs UAE account eligibility); ⬜ Checkout.com / Telr / N-Genius adapters

## Phase 7 — Campaigns
- ✅ Messaging (entitlement-gated, RLS, rate limit, contact-detail filter, attachments, block/report, read receipts)
- ✅ Quotation workflow
- ✅ 16-state campaign FSM, deliverables, approvals, revision limits, publication evidence, medical compliance gate
- ✅ Reviews (one per campaign) and disputes with admin resolution (incl. refunds)

## Phase 8 — AI
- ✅ NL → filters (EN/AR rules parser; Anthropic structured-output adapter 🟡 needs API key)
- ✅ Retrieval from real records, progressive relaxation, explainable ranking, refinement, suggestions, logs, feedback, quality metrics

## Phase 9 — Admin
- 🟢 Users, verification (identity/medical/business/permit/manual metrics), categories, catalogue, benchmarks, grading, bookings, compliance, fees/commission/VAT, payments, refunds, payouts, disputes, AI, moderation, reports (daily/weekly/monthly; by category/creator/business; CSV), reconciliation, audit logs, integrations, localization, platform settings, data requests
- ✅ Audit logging of sensitive admin actions (immutable)

## Phase 10 — Production readiness
- ✅ Automated tests: 55 unit (shared) + 34 API integration/security/unit (Jest) + 5 Playwright E2E (public pages, AI discovery, full business journey, full creator journey) — all passing
- ✅ Security review controls (see SECURITY.md)
- 🟢 Dockerfiles, docker-compose, CI workflow, backup script, deployment guide
- ⬜ Sentry/OpenTelemetry wiring, Redis-backed throttler storage, load testing, penetration test by a third party
- ⬜ Legal review: terms, privacy (PDPL), VAT treatment, advertiser-permit & medical advertising workflows, payment licensing/settlement model

## Next steps (business-owner inputs needed)
1. Meta and TikTok developer apps + App Review submissions.
2. Payment provider selection and merchant onboarding (settlement/payout model decision).
3. Legal entity details, TRN, VAT advice; final Terms & Privacy.
4. Real UAE pricing research to replace SAMPLE benchmarks.
5. Production cloud account (UAE region), domain, SMTP/SMS providers.
