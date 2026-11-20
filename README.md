# InfluenceHub

**Where Brands Meet Influence.** — a UAE-first influencer marketing marketplace (English + Arabic/RTL, AED).

Businesses discover verified creators, unlock direct contact, request quotations and buy influencer services through a multi-creator cart and checkout; creators connect Instagram/TikTok through official logins, get an explainable performance grade, publish rate cards and manage campaigns, earnings and payouts; administrators run verification, pricing, grading, finance, moderation and compliance.

| | |
|---|---|
| Web | Next.js 15 · React 19 · Tailwind · next-intl (EN/AR, RTL) · TanStack Query |
| API | NestJS 11 · REST · OpenAPI (`/api/docs`) · Zod |
| Data | PostgreSQL 16 · Prisma · RLS · immutable ledger · Redis/BullMQ |
| Tests | Vitest · Jest/Supertest · Playwright |

## Quick start (local — Windows, macOS or Linux)
Prerequisites: **Node.js 22**, **Docker Desktop** (running), Git. Then, in a terminal (PowerShell on Windows):
```bash
corepack enable          # makes the `pnpm` command available (run once; on Windows run the terminal as Administrator)
pnpm install
docker compose up -d postgres redis
pnpm setup:local         # creates config files with fresh secrets, sets up the database, loads demo data, builds
```
Then open **three** terminals in the project folder and run one command in each:
```bash
pnpm dev:api      # API on http://localhost:4000 (docs at /api/docs)
pnpm dev:worker   # background jobs
pnpm dev:web      # website on http://localhost:3000
```
Open **http://localhost:3000/en/login**. Admin login: **http://localhost:3000/en/admin/login** — `admin@influencehub.local` / `AdminPass2026!` (change `SEED_ADMIN_PASSWORD` in `packages/database/.env` before running setup if you want a different one).

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
