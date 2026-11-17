# InfluenceHub — Deployment

## Local development
```bash
pnpm install
cp .env.example .env && cp .env.example apps/api/.env   # fill JWT_SECRET, ENCRYPTION_KEY
docker compose up -d postgres redis                       # or local services
pnpm db:migrate && SEED_DEMO_DATA=true pnpm db:seed
pnpm --filter @influencehub/shared build && pnpm --filter @influencehub/database build
pnpm dev:api      # :4000  (Swagger at /api/docs)
pnpm dev:worker   # BullMQ workers + schedulers
pnpm dev:web      # :3000
```
Generate secrets: `openssl rand -base64 48` (JWT_SECRET), `openssl rand -base64 32` (ENCRYPTION_KEY).

## Docker (full stack)
`docker compose up --build` builds `api`, `worker`, `web` images (multi-stage Dockerfiles in `infrastructure/docker/`), runs migrations via the `migrate` one-shot service, then starts everything. Web on :3000.

## Production topology (recommended, UAE data residency)
* **Region**: a UAE region (e.g. AWS `me-central-1`, Azure UAE North, or Google `me-central2`) to align with data-residency expectations — confirm with legal.
* **Web & API**: containers on ECS/Fargate, Kubernetes or similar; ≥2 replicas each behind an ALB; health checks `/api/v1/health/ready` (API) and `/en` (web).
* **Worker**: ≥1 replica (BullMQ is safe with multiple workers; schedulers are idempotent upserts).
* **PostgreSQL**: managed (RDS/Aurora/Cloud SQL), Multi-AZ, PITR enabled, TLS required, `pg_trgm` extension.
* **Redis**: managed (ElastiCache/Memorystore), TLS + auth. Use it as the throttler store when running multiple API replicas.
* **Object storage**: S3 bucket, private, SSE, versioning, lifecycle for old uploads; serve via the API (authorised) or signed URLs.
* **CDN/WAF**: CloudFront/Cloudflare in front of web; WAF managed rules + bot control; HSTS.
* **Secrets**: secret manager → env vars. Never bake secrets into images.

### Required production settings
`APP_ENV=production`, `SOCIAL_SANDBOX_ENABLED=false`, `PAYMENT_PROVIDER=stripe` (or another real adapter), `WEB_ORIGIN` and `API_PUBLIC_URL` on the public HTTPS domain, `COOKIE_DOMAIN` if web and API share a parent domain, SMTP configured. The API refuses to start with sandbox providers in production.

## CI/CD
`.github/workflows/ci.yml`: install → build packages → Prisma migrate on a service Postgres → seed → shared unit tests → localization parity → API typecheck + integration/security tests → web build. Extend with image build & push, then deploy (blue/green or rolling) running `prisma migrate deploy` as a pre-deploy job.

## Monitoring & logging
* Structured logs to stdout (Nest Logger) → CloudWatch/Stackdriver/ELK.
* Error monitoring: add Sentry (`@sentry/nestjs`, `@sentry/nextjs`) with DSN via env.
* Metrics/alerts: API p95 latency, 5xx rate, queue depth/failed jobs, webhook errors (`payment_events.error`), failed social syncs (admin dashboard), DB connections, disk.
* Uptime checks on `/api/v1/health/ready`.

## Backups
* Managed PITR (≥7 days) + nightly logical dump: `infrastructure/scripts/backup.sh` (`pg_dump -Fc`, gzip, encrypt with KMS/age, upload to a separate backup bucket with object lock, retain 35 days).
* Object storage versioning + cross-region replication for uploads.
* **Quarterly restore drill** into an isolated environment; verify ledger balance query: `SELECT "transactionId" FROM financial_ledger GROUP BY 1 HAVING SUM(CASE direction WHEN 'DEBIT' THEN amount ELSE -amount END) <> 0;` returns no rows.

## Scheduled jobs (worker)
| Job | Schedule (Asia/Dubai) |
|---|---|
| Enqueue due social syncs (24h cadence per account) | every 15 min |
| Auto-complete published campaigns after N days | hourly |
| Email outbox retry | every 2 min |
| Expire quotations | hourly |
| Cleanup expired OAuth states / tokens / sessions | daily 03:23 |
