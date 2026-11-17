# InfluenceHub

**Where Brands Meet Influence.** — a UAE-first influencer marketing marketplace (English + Arabic/RTL, AED).

Businesses discover verified creators, unlock direct contact, request quotations and buy influencer services through a multi-creator cart and checkout; creators connect Instagram/TikTok through official logins, get an explainable performance grade, publish rate cards and manage campaigns, earnings and payouts; administrators run verification, pricing, grading, finance, moderation and compliance.

| | |
|---|---|
| Web | Next.js 15 · React 19 · Tailwind · next-intl (EN/AR, RTL) · TanStack Query |
| API | NestJS 11 · REST · OpenAPI (`/api/docs`) · Zod |
| Data | PostgreSQL 16 · Prisma · RLS · immutable ledger · Redis/BullMQ |
| Tests | Vitest · Jest/Supertest · Playwright |

## Quick start (local)
```bash
pnpm install
cp .env.example apps/api/.env          # set JWT_SECRET + ENCRYPTION_KEY (see comments)
docker compose up -d postgres redis    # or use local Postgres 16 + Redis
pnpm --filter @influencehub/shared build
pnpm db:migrate
SEED_DEMO_DATA=true SEED_ADMIN_PASSWORD='ChooseAStrongPassw0rd' pnpm db:seed
pnpm --filter @influencehub/database build
pnpm dev:api   # http://localhost:4000/api/docs
pnpm dev:worker
pnpm dev:web   # http://localhost:3000
```
Demo accounts (sandbox data only): businesses `clinic@demo.influencehub.local`, `bistro@…`, `jewels@…`; creators `<slug>@demo.influencehub.local` (e.g. `dr-layla-haddad@demo.influencehub.local`) — password `DemoPass2026!`. Admin: `admin@influencehub.local` (2FA enrolment on first login at `/en/admin/login`).

Sandbox providers simulate Instagram/TikTok OAuth and a hosted payment page so every flow works end-to-end locally. **They are labelled in the UI and are refused when `APP_ENV=production`.**

## Tests
```bash
pnpm --filter @influencehub/shared test          # 55 domain unit tests
pnpm --filter @influencehub/localization test    # EN/AR key parity
pnpm --filter @influencehub/api test             # 34 API integration + security tests (needs influencehub_test DB)
pnpm --filter @influencehub/web test:e2e         # Playwright E2E against running API + web
```

## Documentation
* [ARCHITECTURE.md](documentation/ARCHITECTURE.md) — system design, flows, module map
* [DATABASE.md](documentation/DATABASE.md) — ERD, ledger model, RLS, retention
* [API_DOCUMENTATION.md](documentation/API_DOCUMENTATION.md) — endpoints & conventions
* [SECURITY.md](documentation/SECURITY.md) — controls ↔ tests, compliance notes
* [INTEGRATION_SETUP.md](documentation/INTEGRATION_SETUP.md) — Instagram, TikTok, Google, payments, AI: status and approvals needed
* [DEPLOYMENT.md](documentation/DEPLOYMENT.md) — environments, Docker, CI/CD, monitoring, backups
* [DEVELOPMENT_ROADMAP.md](documentation/DEVELOPMENT_ROADMAP.md) — phase checklist and remaining owner inputs

## Important limitations
* Instagram, TikTok, Google, Stripe and Anthropic adapters are implemented against the official APIs but are **not live** until credentials and platform approvals are in place and tested.
* Pricing benchmarks are **SAMPLE** data; there is no official UAE influencer price list.
* Terms, privacy policy, VAT treatment, advertiser-permit and medical-advertising workflows require UAE legal/tax review before launch.
