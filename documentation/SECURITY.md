# InfluenceHub — Security

Security is a product requirement. This document maps each control to its implementation and test.

## Threat model highlights
| Threat | Control | Where | Test |
|---|---|---|---|
| Credential stuffing / brute force | argon2id; 5-failure lockout (15 min); per-route rate limits; identical error for unknown users; dummy hash to equalise timing | `auth.service.ts`, `@Throttle` | `auth.spec.ts` (lockout, enumeration), `security.spec.ts` (rate limit) |
| Session theft / replay | HttpOnly+Secure+SameSite=Lax cookies; 15-min JWT; opaque refresh token hashed in DB; rotation with **reuse detection → revoke all sessions**; admin sessions 8 h | `auth.service.ts` | `auth.spec.ts` |
| CSRF | Double-submit token (`ih_csrf` cookie + `x-csrf-token` header) on every cookie-authenticated unsafe request; webhooks exempt (signature-auth) | `auth.guard.ts` | `security.spec.ts` |
| Admin account takeover | Mandatory TOTP enrolment before any admin endpoint (`ADMIN_2FA_REQUIRED`); TOTP secret encrypted; admin login audited | `auth.service.ts`, guard | `auth.spec.ts` |
| Privilege escalation | Global guard; least-privilege admin roles (Super, Marketplace, Influencer Verification, Finance, Support, Content Moderator); permission checks per endpoint; cannot demote/suspend self | `packages/shared/src/permissions.ts`, `admin.controller.ts` | `security.spec.ts`, `domain.test.ts` |
| IDOR / cross-tenant leakage | Every read/write scopes by owner (`businessId`/`influencerId`/participant); foreign resources return **404**; PostgreSQL RLS for conversations/messages/notifications/tokens | services, `hardening` migration | `security.spec.ts` (orders, invoices, campaigns, conversations, services, social accounts, RLS) |
| Unauthorised contact | Messaging and quotation requests require a live contact entitlement, checked on every send; contact-detail sharing blocked pre-booking | `messaging.service.ts`, `quotations.service.ts` | `security.spec.ts` |
| Duplicate / forged payments | Raw-body HMAC verification with timestamp tolerance; unique `(provider, providerEventId)`; `SELECT … FOR UPDATE`; amount & currency must match; idempotency keys on checkout, contact purchase, refunds; double-fulfilment impossible | `payments.service.ts`, providers | `security.spec.ts` (forged, stale, tampered, duplicate, second event id, amount mismatch) |
| Ledger tampering | Append-only trigger on `financial_ledger` and `audit_logs`; balance enforced by deferred constraint trigger | `hardening` migration | `marketplace.spec.ts`, `security.spec.ts` |
| Fake social metrics | Only official APIs; OAuth proves account control; one platform account ↔ one creator; outlier detection (views ≫ followers, engagement > 35%); manual metrics labelled & weighted 0.5 until reviewed; sandbox data excluded in production | `social.service.ts`, `grading.ts` | `grading.test.ts`, `marketplace.spec.ts` |
| OAuth attacks | Server-side single-use hashed `state` (10 min); PKCE (TikTok, Google); callback must complete in the initiating user's session; redirect allow-list (relative only) | `oauth-state.service.ts`, `social.service.ts` | `marketplace.spec.ts` (invalid/replayed/foreign state), `pricing-calculator.spec.ts` (open redirect) |
| Token exposure | AES-256-GCM (versioned envelope) for OAuth tokens, PKCE verifiers, TOTP secrets; tokens never serialised in API responses; destroyed on disconnect | `crypto.service.ts` | `marketplace.spec.ts` |
| Malicious uploads | Magic-byte detection (JPEG/PNG/WebP/PDF/MP4 only), per-purpose allow-list, PDF active-content rejection, size cap, randomised keys, private by default, `nosniff` + sandbox CSP on download, path-traversal guard | `uploads.service.ts` | `security.spec.ts` |
| XSS | React escaping; no `dangerouslySetInnerHTML`; email templates HTML-escaped; strict CSP on API HTML pages | web, `templates.ts` | — |
| SQL injection | Prisma parameterisation; the few raw queries use tagged templates; sequence names are internal constants | — | — |
| Bot abuse | Rate limits on auth, uploads, AI, checkout, messaging (per-minute cap in DB), report throttling | throttler + services | `security.spec.ts` |
| Data leakage via logs | Audit log redacts keys matching `password|token|secret|hash|totp`; errors return generic envelopes | `audit.service.ts`, `http-exception.filter.ts` | — |

## Secrets management
* No secrets in code or the repository. `.env.example` documents variables; production values come from a secret manager (AWS Secrets Manager / GCP Secret Manager / Vault) injected as env vars.
* `ENCRYPTION_KEY` = 32 random bytes (base64). Rotation: deploy new key version, re-encrypt with a one-off job (`keyVersion` column on tokens supports staged rotation).
* Production refuses to start with sandbox social or sandbox payments enabled.

## Privacy & compliance notes (require legal review)
* UAE PDPL-oriented: consent records (terms, privacy, marketing, social data processing, public profile), export, deletion/anonymisation, data minimisation (only authorised scopes), token revocation on disconnect.
* **Advertising**: UAE rules may require creator advertiser permits; InfluenceHub collects permit details for review but **verification badges are not legal permits**.
* **Medical advertising**: categories flagged `requiresMedicalCompliance` force campaigns into `PENDING_REVIEW` compliance; publication is blocked until an admin approves (health-authority rules, DHA/DOH/MOHAP licensing).
* **VAT**: 5% standard rate configurable; treatment of commission vs full booking value must be confirmed by a UAE tax adviser.
* **Payments/escrow**: the platform does not assume regulated custody; settlement must follow the chosen PSP's marketplace product (e.g. connected accounts/split payouts) and licensing advice.
* No claim of regulatory compliance is made without legal review.

## Operational security
* Dependencies pinned by lockfile; CI runs typecheck + tests on every push.
* Recommended: WAF in front of the web tier, Redis-backed throttler storage for multi-instance, Sentry/OpenTelemetry for error monitoring, centralised JSON logs, alerting on webhook errors and failed syncs (exposed on admin dashboard).
* Incident response: revoke sessions (`sessions.revokedAt`), rotate keys, disable integrations from Admin → API integrations, review `audit_logs`.
