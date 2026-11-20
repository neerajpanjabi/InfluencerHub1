# InfluenceHub — Integration setup

Every external integration is implemented behind an adapter with configuration, error states and sandbox/mocks. **None is "live" until tested against the official provider with real credentials and approvals.** Status as of this build:

| Integration | Code | Status | What the owner must provide |
|---|---|---|---|
| Instagram API with Instagram Login | `apps/api/src/modules/social/adapters/instagram.adapter.ts` | Implemented, **awaiting Meta app + App Review** | Meta developer app, Instagram product, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, approved permissions |
| TikTok Login Kit + Display API | `…/tiktok.adapter.ts` | Implemented, **awaiting TikTok app approval** | TikTok developer app, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, approved scopes |
| Google OAuth (business login) | `auth.service.ts` (OIDC + PKCE) | Implemented, needs credentials | OAuth client (Web), `GOOGLE_CLIENT_ID/SECRET` |
| Stripe Checkout | `…/payments/providers/stripe.provider.ts` | Implemented, **needs account eligibility check for UAE/AED** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Checkout.com / Telr / Network International (N-Genius) | — | **Not implemented** (evaluate; add an adapter implementing `PaymentProvider`) | Merchant onboarding, marketplace/split-settlement product, API keys |
| Sandbox payments | `…/sandbox.provider.ts` | Working (dev/test only; disabled in production) | — |
| Sandbox social | `…/sandbox.adapter.ts` | Working (dev/test only; data labelled "Sandbox") | `SOCIAL_SANDBOX_ENABLED=true` |
| Anthropic Claude (AI query understanding) | `apps/api/src/modules/ai/llm.provider.ts` | Implemented (official SDK, structured outputs); optional | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` |
| Email (SMTP) | `email.service.ts` | Implemented (console fallback in dev) | `SMTP_URL`, `EMAIL_FROM` (e.g. SES/Postmark/SendGrid SMTP) |
| SMS | `notifications.service.ts` | Console provider only | Approved UAE SMS provider + adapter |
| Object storage | `uploads.service.ts` | Local disk + S3 implemented | `STORAGE_DRIVER=s3`, bucket, region (`me-central-1` recommended), IAM role |

## Instagram (Meta)
1. Create an app at developers.facebook.com → add **Instagram** product → *API setup with Instagram login*.
2. Valid OAuth redirect URI: `https://<your-domain>/api/v1/social/instagram/callback`.
3. Request permissions **`instagram_business_basic`** and **`instagram_business_manage_insights`**; complete Business Verification and App Review (screencast of the connect flow and how insights are displayed).
4. Set `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_API_VERSION` (default `v23.0`).
5. Only **Professional (Business/Creator)** accounts can grant insights. Personal accounts are linked for identity but show insights as *Unavailable*.
6. Data fetched (where permitted): user id, username, name, account type, profile picture, followers, follows, media count, biography; recent media with likes/comments; per-media insights `views`, `reach`, `saved`, `shares`; current stories with `views`/`reach` (stories are only available for 24 h, so averages accumulate across syncs); follower demographics by country (needs 100+ followers).
7. Tokens: short-lived → long-lived (60 days), refreshed automatically when within 7 days of expiry. There is no revoke endpoint for Instagram Login; on disconnect we destroy our copy and instruct creators how to remove app access in Instagram settings.
8. Metrics that the API does not return are recorded as unavailable — **never estimated**.

## TikTok
1. Create an app at developers.tiktok.com; add **Login Kit** (web) and **Display API**.
2. Redirect URI: `https://<your-domain>/api/v1/social/tiktok/callback`.
3. Scopes: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`. Submit for review.
4. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. The adapter uses state + PKCE (S256), server-side token exchange, refresh tokens and the revoke endpoint on disconnect.
5. Data: open_id, username, display name, avatar, bio, follower/following/likes/video counts, up to 20 recent videos with views/likes/comments/shares. **Story views and private analytics are not available from TikTok** and are shown as unavailable.

## Google
Create an OAuth client (Web) with redirect `https://<your-domain>/api/v1/auth/google/callback`, scopes `openid email profile`. Google sign-in is offered to businesses; existing accounts link only when the Google email is verified and matches.

## Payments
* Recommended evaluation order for UAE marketplace settlement: **Checkout.com** (marketplace/sub-entities), **Network International N-Genius**, **Telr**, **Stripe** (UAE availability & marketplace features subject to eligibility). Decision depends on merchant-of-record vs agent model, payouts to creators, and licensing advice — this is a business-owner decision.
* To add a provider: implement `PaymentProvider` (`createCheckout`, `parseWebhook` with signature verification, `refund`), register it in `PaymentsService.providers`, set `PAYMENT_PROVIDER`.
* Stripe webhook endpoint: `https://<your-domain>/api/v1/payments/webhooks/stripe`; events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
* Payouts to creators are recorded and marked paid by Finance admins (bank transfer reference). Automating payouts requires the PSP's payout/connected-account product.

## AI provider
Set `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optionally `LLM_MODEL` (default `claude-opus-5-5`). The model only converts text to filters (validated against enums); results always come from the database. On errors, refusals or timeouts the deterministic parser is used.

## Webhook/redirect hostnames
All provider callbacks go to the **web origin** (`/api/v1/...` is proxied to the API), so a single public hostname is needed.
