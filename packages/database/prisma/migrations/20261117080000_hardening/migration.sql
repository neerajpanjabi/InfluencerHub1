-- InfluenceHub hardening migration: constraints Prisma cannot express, immutable ledger,
-- trigram search indexes and Row Level Security (defence in depth).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── CHECK constraints ──────────────────────────────────────────────
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE influencer_services ADD CONSTRAINT influencer_services_price_positive CHECK (price > 0);
ALTER TABLE influencer_services ADD CONSTRAINT influencer_services_promo_below_price CHECK ("promoPrice" IS NULL OR "promoPrice" < price);
ALTER TABLE influencer_services ADD CONSTRAINT influencer_services_delivery_positive CHECK ("deliveryDays" > 0);
ALTER TABLE financial_ledger ADD CONSTRAINT financial_ledger_amount_positive CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT payments_single_purpose CHECK (
  ("orderId" IS NOT NULL AND "contactPurchaseId" IS NULL) OR ("orderId" IS NULL AND "contactPurchaseId" IS NOT NULL)
);
ALTER TABLE refunds ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0);
ALTER TABLE orders ADD CONSTRAINT orders_totals_non_negative CHECK (subtotal >= 0 AND "vatTotal" >= 0 AND "grandTotal" >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_refund_bounds CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "grossAmount" + "businessCommission" + "vatAmount");
ALTER TABLE pricing_benchmarks ADD CONSTRAINT pricing_benchmarks_ordering CHECK ("minRate" <= "medianRate" AND "medianRate" <= "maxRate");
ALTER TABLE influencer_scores ADD CONSTRAINT influencer_scores_range CHECK (score IS NULL OR (score >= 0 AND score <= 100));
ALTER TABLE cart_items ADD CONSTRAINT cart_items_single_target CHECK (
  (CASE WHEN "serviceId" IS NULL THEN 0 ELSE 1 END) + (CASE WHEN "packageId" IS NULL THEN 0 ELSE 1 END) + (CASE WHEN "quotationId" IS NULL THEN 0 ELSE 1 END) = 1
);
ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity CHECK (quantity BETWEEN 1 AND 50);

-- Only one ACTIVE cart per business
CREATE UNIQUE INDEX carts_one_active_per_business ON carts ("businessId") WHERE status = 'ACTIVE';
-- Only one live (non-revoked) entitlement per business/influencer pair
CREATE UNIQUE INDEX contact_entitlements_one_live ON contact_entitlements ("businessId", "influencerId") WHERE "revokedAt" IS NULL;
-- Only one current score per influencer
CREATE UNIQUE INDEX influencer_scores_one_current ON influencer_scores ("influencerId") WHERE "isCurrent" = true;

-- ── Immutable financial ledger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger is append-only (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financial_ledger_immutable
  BEFORE UPDATE OR DELETE ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- Same protection for raw payment webhook events and audit logs
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- Each ledger transaction must balance (debits = credits). Checked at commit time.
CREATE OR REPLACE FUNCTION check_ledger_balance() RETURNS trigger AS $$
DECLARE
  imbalance numeric;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END), 0)
    INTO imbalance FROM financial_ledger WHERE "transactionId" = NEW."transactionId";
  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % does not balance (imbalance %)', NEW."transactionId", imbalance;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER financial_ledger_balanced
  AFTER INSERT ON financial_ledger
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_ledger_balance();

-- ── Search indexes (English + Arabic trigram) ──────────────────────
CREATE INDEX influencer_profiles_search_trgm ON influencer_profiles USING gin ("searchText" gin_trgm_ops);
CREATE INDEX influencer_profiles_languages_gin ON influencer_profiles USING gin (languages);
CREATE INDEX influencer_profiles_audience_gin ON influencer_profiles USING gin ("audienceLocations");
CREATE INDEX categories_name_trgm ON categories USING gin ("nameEn" gin_trgm_ops, "nameAr" gin_trgm_ops);

-- ── Row Level Security (defence in depth) ──────────────────────────
-- The API sets `app.current_user_id` (SET LOCAL inside a transaction) for user-scoped reads of
-- private communication data. When set, rows are restricted to the user's own conversations.
-- System contexts (workers, admin services) do not set it and are governed by API authorization.
CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversations_isolation ON conversations
  USING (app_current_user() IS NULL OR "businessUserId" = app_current_user() OR "influencerUserId" = app_current_user());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_isolation ON messages
  USING (
    app_current_user() IS NULL OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp."conversationId" = messages."conversationId" AND cp."userId" = app_current_user()
    )
  );

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_isolation ON notifications
  USING (app_current_user() IS NULL OR "userId" = app_current_user());

ALTER TABLE social_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_oauth_tokens FORCE ROW LEVEL SECURITY;
-- Tokens are never readable from a user-scoped context, only from system (sync/OAuth) contexts.
CREATE POLICY social_tokens_system_only ON social_oauth_tokens
  USING (app_current_user() IS NULL);
