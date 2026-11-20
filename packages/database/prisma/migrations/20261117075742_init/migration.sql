-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('BUSINESS', 'INFLUENCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('AE', 'SA', 'QA', 'BH', 'KW', 'OM');

-- CreateEnum
CREATE TYPE "Emirate" AS ENUM ('DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('FOLLOWERS', 'FOLLOWING', 'MEDIA_COUNT', 'AVG_REEL_VIEWS', 'AVG_STORY_VIEWS', 'AVG_VIDEO_VIEWS', 'AVG_LIKES', 'AVG_COMMENTS', 'ENGAGEMENT_RATE', 'REACH', 'IMPRESSIONS', 'TOTAL_LIKES', 'VIDEO_COUNT');

-- CreateEnum
CREATE TYPE "MetricVerification" AS ENUM ('API_VERIFIED', 'MANUALLY_SUBMITTED', 'PENDING_VERIFICATION', 'UNAVAILABLE', 'EXPIRED', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('INSTAGRAM_API', 'TIKTOK_API', 'MANUAL', 'SANDBOX', 'DEMO_SEED');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('CONNECTED', 'TOKEN_EXPIRED', 'REVOKED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'PHONE', 'BUSINESS_LICENCE', 'IDENTITY', 'MEDICAL_QUALIFICATION', 'SOCIAL_ACCOUNT', 'ADVERTISER_PERMIT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('S', 'A', 'B', 'C', 'D', 'NOT_RATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CommissionPayer" AS ENUM ('BUSINESS', 'INFLUENCER', 'SPLIT');

-- CreateEnum
CREATE TYPE "ContactEntitlementSource" AS ENUM ('PURCHASE', 'ADMIN_GRANT', 'FREE_ALLOWANCE', 'BOOKING');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CartItemType" AS ENUM ('SERVICE', 'PACKAGE', 'QUOTATION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('ORDER', 'CONTACT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'ON_HOLD', 'SCHEDULED', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('BUSINESS_RECEIVABLE', 'CASH_CLEARING', 'PLATFORM_COMMISSION_REVENUE', 'PLATFORM_CONTACT_FEE_REVENUE', 'INFLUENCER_PAYABLE', 'VAT_PAYABLE', 'PROCESSING_FEE_EXPENSE', 'REFUNDS', 'PAYOUTS');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ENQUIRY', 'QUOTATION_REQUESTED', 'QUOTATION_SUBMITTED', 'AWAITING_ACCEPTANCE', 'PAYMENT_PENDING', 'CONFIRMED', 'IN_PROGRESS', 'CONTENT_SUBMITTED', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REVISION_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUSINESS', 'RESOLVED_INFLUENCER', 'RESOLVED_SPLIT', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING', 'SOCIAL_DATA_PROCESSING', 'PUBLIC_PROFILE');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMPTZ(6),
    "passwordHash" TEXT,
    "type" "UserType" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isAdminSession" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorPassed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" UUID NOT NULL,
    "stateHash" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" UUID,
    "codeVerifier" TEXT,
    "redirectPath" TEXT,
    "userType" "UserType",
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "phone" TEXT,
    "country" "Country" NOT NULL DEFAULT 'AE',
    "emirate" "Emirate",
    "city" TEXT,
    "website" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "tradeLicenceNumber" TEXT,
    "tradeLicenceAuthority" TEXT,
    "tradeLicenceExpiry" DATE,
    "trnNumber" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "campaignPreferences" JSONB,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "freeContactCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameAr" TEXT,
    "profileImageUrl" TEXT,
    "coverImageUrl" TEXT,
    "bio" TEXT,
    "bioAr" TEXT,
    "phone" TEXT,
    "country" "Country" NOT NULL DEFAULT 'AE',
    "emirate" "Emirate",
    "city" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "languages" TEXT[],
    "specialities" TEXT[],
    "contentNiches" TEXT[],
    "audienceLocations" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "visibility" JSONB,
    "identityStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isMedicalProfessional" BOOLEAN NOT NULL DEFAULT false,
    "medicalStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "advertiserPermitNumber" TEXT,
    "advertiserPermitExpiry" DATE,
    "advertiserPermitStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "acceptingBookings" BOOLEAN NOT NULL DEFAULT true,
    "minimumBudget" DECIMAL(14,2),
    "currentScore" DECIMAL(5,2),
    "currentGrade" "Grade" NOT NULL DEFAULT 'NOT_RATED',
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "avgReelViews" INTEGER,
    "avgStoryViews" INTEGER,
    "avgVideoViews" INTEGER,
    "engagementRate" DECIMAL(6,3),
    "startingPrice" DECIMAL(14,2),
    "ratingAverage" DECIMAL(3,2),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "influencer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_credentials" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "profession" TEXT NOT NULL,
    "speciality" TEXT,
    "licensingAuthority" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "licenceExpiry" DATE,
    "documentId" UUID,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medical_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" UUID NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "verification_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "referenceId" TEXT,
    "documentIds" TEXT[],
    "data" JSONB,
    "notes" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" UUID,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresMedicalCompliance" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_categories" (
    "influencerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "influencer_categories_pkey" PRIMARY KEY ("influencerId","categoryId")
);

-- CreateTable
CREATE TABLE "business_categories" (
    "businessId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "business_categories_pkey" PRIMARY KEY ("businessId","categoryId")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profileImageUrl" TEXT,
    "biography" TEXT,
    "accountType" TEXT,
    "profileUrl" TEXT,
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "apiVersion" TEXT,
    "connectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMPTZ(6),
    "lastSyncedAt" TIMESTAMPTZ(6),
    "nextSyncAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_oauth_tokens" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenType" TEXT,
    "scopes" TEXT[],
    "accessTokenExpiresAt" TIMESTAMPTZ(6),
    "refreshTokenExpiresAt" TIMESTAMPTZ(6),
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_metric_snapshots" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "sampleSize" INTEGER,
    "source" "MetricSource" NOT NULL,
    "verificationStatus" "MetricVerification" NOT NULL,
    "apiVersion" TEXT,
    "collectedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_posts" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "providerMediaId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "caption" TEXT,
    "permalink" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "views" INTEGER,
    "reach" INTEGER,
    "source" "MetricSource" NOT NULL,
    "fetchedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_media_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_insights" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(8,4) NOT NULL,
    "source" "MetricSource" NOT NULL,
    "verificationStatus" "MetricVerification" NOT NULL,
    "collectedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audience_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_sync_logs" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "metricsWritten" INTEGER NOT NULL DEFAULT 0,
    "postsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "social_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_permissions" (
    "id" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_rules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_rule_versions" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_scores" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "score" DECIMAL(5,2),
    "grade" "Grade" NOT NULL,
    "breakdown" JSONB NOT NULL,
    "dataCoverage" DECIMAL(4,3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "computedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_score_history" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "score" DECIMAL(5,2),
    "grade" "Grade" NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "influencer_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "defaultDeliverables" JSONB NOT NULL,
    "complexityFactor" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "commissionRate" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_services" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "catalogId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "platform" "Platform" NOT NULL,
    "deliverables" JSONB NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "promoPrice" DECIMAL(14,2),
    "promoEndsAt" TIMESTAMPTZ(6),
    "minimumPrice" DECIMAL(14,2),
    "suggestedPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "deliveryDays" INTEGER NOT NULL,
    "revisions" INTEGER NOT NULL DEFAULT 1,
    "usageRights" TEXT,
    "usageRightsDays" INTEGER,
    "exclusivityDays" INTEGER,
    "addOns" JSONB,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'STANDARD',
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "influencer_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleAr" TEXT,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "deliveryDays" INTEGER NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_items" (
    "packageId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "service_package_items_pkey" PRIMARY KEY ("packageId","serviceId")
);

-- CreateTable
CREATE TABLE "pricing_benchmarks" (
    "id" UUID NOT NULL,
    "categoryId" UUID,
    "subcategory" TEXT,
    "emirate" "Emirate",
    "platform" "Platform" NOT NULL,
    "catalogId" UUID,
    "grade" "Grade",
    "followersMin" INTEGER,
    "followersMax" INTEGER,
    "avgViewsMin" INTEGER,
    "avgViewsMax" INTEGER,
    "minRate" DECIMAL(14,2) NOT NULL,
    "medianRate" DECIMAL(14,2) NOT NULL,
    "maxRate" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "isSample" BOOLEAN NOT NULL DEFAULT true,
    "researchSource" TEXT NOT NULL,
    "researchedAt" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_history" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "oldPrice" DECIMAL(14,2),
    "newPrice" DECIMAL(14,2) NOT NULL,
    "suggested" DECIMAL(14,2),
    "changedById" UUID,
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "campaignId" UUID,
    "status" "QuotationStatus" NOT NULL DEFAULT 'REQUESTED',
    "brief" TEXT NOT NULL,
    "requestedBudget" DECIMAL(14,2),
    "subtotal" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "validUntil" TIMESTAMPTZ(6),
    "influencerNote" TEXT,
    "submittedAt" TIMESTAMPTZ(6),
    "respondedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "deliveryDays" INTEGER NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_influencers" (
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_influencers_pkey" PRIMARY KEY ("businessId","influencerId")
);

-- CreateTable
CREATE TABLE "contact_entitlements" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "source" "ContactEntitlementSource" NOT NULL,
    "purchaseId" UUID,
    "grantedById" UUID,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_purchases" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "type" "CartItemType" NOT NULL,
    "serviceId" UUID,
    "packageId" UUID,
    "quotationId" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addOnKeys" TEXT[],
    "brief" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" DECIMAL(5,2),
    "amountOff" DECIMAL(14,2),
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ(6),
    "validUntil" TIMESTAMPTZ(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "businessCommissionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "discountCode" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "serviceId" UUID,
    "quotationId" UUID,
    "packageId" UUID,
    "description" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "addOnsTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionPayer" "CommissionPayer" NOT NULL,
    "businessCommission" DECIMAL(14,2) NOT NULL,
    "influencerCommission" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "influencerNet" DECIMAL(14,2) NOT NULL,
    "taxTreatment" "TaxTreatment" NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "orderId" UUID,
    "contactPurchaseId" UUID,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerSessionId" TEXT,
    "checkoutUrl" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "processingFee" DECIMAL(14,2),
    "idempotencyKey" TEXT NOT NULL,
    "failureReason" TEXT,
    "succeededAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentId" UUID,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMPTZ(6),
    "error" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "orderId" UUID,
    "orderItemId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedById" UUID,
    "approvedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "commissionIds" TEXT[],
    "scheduledFor" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "payer" "CommissionPayer" NOT NULL,
    "businessPortion" DECIMAL(14,2) NOT NULL,
    "influencerPortion" DECIMAL(14,2) NOT NULL,
    "totalCommission" DECIMAL(14,2) NOT NULL,
    "influencerNet" DECIMAL(14,2) NOT NULL,
    "releasedAt" TIMESTAMPTZ(6),
    "payoutId" UUID,
    "reversedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" UUID,
    "contactPurchaseId" UUID,
    "issuedTo" JSONB NOT NULL,
    "issuedBy" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vatTotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ledger" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "referenceType" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "influencerId" UUID,
    "businessId" UUID,
    "categoryId" UUID,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_records" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "ledgerTotal" DECIMAL(14,2) NOT NULL,
    "providerTotal" DECIMAL(14,2),
    "difference" DECIMAL(14,2),
    "status" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "businessUserId" UUID NOT NULL,
    "influencerUserId" UUID NOT NULL,
    "campaignId" UUID,
    "lastMessageAt" TIMESTAMPTZ(6),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMPTZ(6),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "flaggedReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "messageId" UUID,
    "deliverableId" UUID,
    "purpose" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "params" JSONB,
    "link" TEXT,
    "readAt" TIMESTAMPTZ(6),
    "emailedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId","type","channel")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "orderItemId" UUID,
    "title" TEXT NOT NULL,
    "brief" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "platforms" "Platform"[],
    "requiredMentions" TEXT[],
    "requiredHashtags" TEXT[],
    "postingDeadline" TIMESTAMPTZ(6),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "usageRights" TEXT,
    "contractTerms" TEXT,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "complianceNotes" TEXT,
    "agreedAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_deliverables" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "dueAt" TIMESTAMPTZ(6),
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "draftUrl" TEXT,
    "draftNotes" TEXT,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "maxRevisions" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaign_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_approvals" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "deliverableId" UUID,
    "decidedById" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_events" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "actorId" UUID,
    "fromStatus" "CampaignStatus",
    "toStatus" "CampaignStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "response" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "raisedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "refundAmount" DECIMAL(14,2),
    "assignedToId" UUID,
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_search_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionKey" TEXT,
    "query" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "parser" TEXT NOT NULL,
    "parsedFilters" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "searchLogId" UUID NOT NULL,
    "businessId" UUID,
    "influencerId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(6,3) NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendation_feedback" (
    "id" UUID NOT NULL,
    "recommendationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "publicConfig" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastCheckedAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "processedAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "toAddress" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "template" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_type_status_idx" ON "users"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key" ON "auth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_tokenHash_key" ON "one_time_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "one_time_tokens_userId_purpose_idx" ON "one_time_tokens"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_stateHash_key" ON "oauth_states"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_userId_key" ON "business_profiles"("userId");

-- CreateIndex
CREATE INDEX "business_profiles_emirate_idx" ON "business_profiles"("emirate");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_profiles_userId_key" ON "influencer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_profiles_slug_key" ON "influencer_profiles"("slug");

-- CreateIndex
CREATE INDEX "influencer_profiles_isPublic_currentGrade_idx" ON "influencer_profiles"("isPublic", "currentGrade");

-- CreateIndex
CREATE INDEX "influencer_profiles_emirate_idx" ON "influencer_profiles"("emirate");

-- CreateIndex
CREATE INDEX "influencer_profiles_totalFollowers_idx" ON "influencer_profiles"("totalFollowers");

-- CreateIndex
CREATE INDEX "influencer_profiles_startingPrice_idx" ON "influencer_profiles"("startingPrice");

-- CreateIndex
CREATE INDEX "medical_credentials_status_idx" ON "medical_credentials"("status");

-- CreateIndex
CREATE INDEX "verification_records_type_status_idx" ON "verification_records"("type", "status");

-- CreateIndex
CREATE INDEX "verification_records_userId_idx" ON "verification_records"("userId");

-- CreateIndex
CREATE INDEX "availability_slots_influencerId_startsOn_idx" ON "availability_slots"("influencerId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "influencer_categories_categoryId_idx" ON "influencer_categories"("categoryId");

-- CreateIndex
CREATE INDEX "social_accounts_influencerId_idx" ON "social_accounts"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_providerAccountId_key" ON "social_accounts"("platform", "providerAccountId");

-- CreateIndex
CREATE INDEX "social_oauth_tokens_socialAccountId_idx" ON "social_oauth_tokens"("socialAccountId");

-- CreateIndex
CREATE INDEX "social_oauth_tokens_accessTokenExpiresAt_idx" ON "social_oauth_tokens"("accessTokenExpiresAt");

-- CreateIndex
CREATE INDEX "social_metric_snapshots_socialAccountId_metricType_collecte_idx" ON "social_metric_snapshots"("socialAccountId", "metricType", "collectedAt" DESC);

-- CreateIndex
CREATE INDEX "social_media_posts_socialAccountId_publishedAt_idx" ON "social_media_posts"("socialAccountId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_media_posts_socialAccountId_providerMediaId_key" ON "social_media_posts"("socialAccountId", "providerMediaId");

-- CreateIndex
CREATE INDEX "audience_insights_socialAccountId_dimension_collectedAt_idx" ON "audience_insights"("socialAccountId", "dimension", "collectedAt");

-- CreateIndex
CREATE INDEX "social_sync_logs_socialAccountId_startedAt_idx" ON "social_sync_logs"("socialAccountId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_permissions_socialAccountId_scope_key" ON "social_permissions"("socialAccountId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "grading_rules_key_key" ON "grading_rules"("key");

-- CreateIndex
CREATE UNIQUE INDEX "grading_rule_versions_ruleId_version_key" ON "grading_rule_versions"("ruleId", "version");

-- CreateIndex
CREATE INDEX "influencer_scores_influencerId_isCurrent_idx" ON "influencer_scores"("influencerId", "isCurrent");

-- CreateIndex
CREATE INDEX "influencer_score_history_influencerId_recordedAt_idx" ON "influencer_score_history"("influencerId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_key_key" ON "service_catalog"("key");

-- CreateIndex
CREATE INDEX "influencer_services_influencerId_status_idx" ON "influencer_services"("influencerId", "status");

-- CreateIndex
CREATE INDEX "influencer_services_catalogId_idx" ON "influencer_services"("catalogId");

-- CreateIndex
CREATE INDEX "pricing_benchmarks_platform_catalogId_grade_idx" ON "pricing_benchmarks"("platform", "catalogId", "grade");

-- CreateIndex
CREATE INDEX "pricing_history_serviceId_changedAt_idx" ON "pricing_history"("serviceId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_number_key" ON "quotations"("number");

-- CreateIndex
CREATE INDEX "quotations_businessId_status_idx" ON "quotations"("businessId", "status");

-- CreateIndex
CREATE INDEX "quotations_influencerId_status_idx" ON "quotations"("influencerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contact_entitlements_purchaseId_key" ON "contact_entitlements"("purchaseId");

-- CreateIndex
CREATE INDEX "contact_entitlements_businessId_influencerId_idx" ON "contact_entitlements"("businessId", "influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_purchases_idempotencyKey_key" ON "contact_purchases"("idempotencyKey");

-- CreateIndex
CREATE INDEX "contact_purchases_businessId_influencerId_status_idx" ON "contact_purchases"("businessId", "influencerId", "status");

-- CreateIndex
CREATE INDEX "carts_businessId_status_idx" ON "carts"("businessId", "status");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_businessId_status_idx" ON "orders"("businessId", "status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_influencerId_idx" ON "order_items"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_contactPurchaseId_idx" ON "payments"("contactPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerSessionId_key" ON "payments"("provider", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_providerEventId_key" ON "payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotencyKey_key" ON "refunds"("idempotencyKey");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "payouts_influencerId_status_idx" ON "payouts"("influencerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_orderItemId_key" ON "commissions"("orderItemId");

-- CreateIndex
CREATE INDEX "commissions_influencerId_idx" ON "commissions"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "financial_ledger_transactionId_idx" ON "financial_ledger"("transactionId");

-- CreateIndex
CREATE INDEX "financial_ledger_account_createdAt_idx" ON "financial_ledger"("account", "createdAt");

-- CreateIndex
CREATE INDEX "financial_ledger_referenceType_referenceId_idx" ON "financial_ledger"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_businessUserId_influencerUserId_key" ON "conversations"("businessUserId", "influencerUserId");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "content_reports"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_number_key" ON "campaigns"("number");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_orderItemId_key" ON "campaigns"("orderItemId");

-- CreateIndex
CREATE INDEX "campaigns_businessId_status_idx" ON "campaigns"("businessId", "status");

-- CreateIndex
CREATE INDEX "campaigns_influencerId_status_idx" ON "campaigns"("influencerId", "status");

-- CreateIndex
CREATE INDEX "campaign_deliverables_campaignId_idx" ON "campaign_deliverables"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_events_campaignId_createdAt_idx" ON "campaign_events"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_influencerId_idx" ON "reviews"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_campaignId_businessId_key" ON "reviews"("campaignId", "businessId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "ai_search_logs_createdAt_idx" ON "ai_search_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_searchLogId_idx" ON "ai_recommendations"("searchLogId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_recommendation_feedback_recommendationId_userId_key" ON "ai_recommendation_feedback"("recommendationId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_provider_key" ON "integration_configs"("provider");

-- CreateIndex
CREATE INDEX "consent_records_userId_type_idx" ON "consent_records"("userId", "type");

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "email_outbox_status_createdAt_idx" ON "email_outbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_profiles" ADD CONSTRAINT "influencer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_credentials" ADD CONSTRAINT "medical_credentials_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_categories" ADD CONSTRAINT "influencer_categories_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_categories" ADD CONSTRAINT "influencer_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_tokens" ADD CONSTRAINT "social_oauth_tokens_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_metric_snapshots" ADD CONSTRAINT "social_metric_snapshots_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_insights" ADD CONSTRAINT "audience_insights_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_sync_logs" ADD CONSTRAINT "social_sync_logs_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_permissions" ADD CONSTRAINT "social_permissions_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_rule_versions" ADD CONSTRAINT "grading_rule_versions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "grading_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_scores" ADD CONSTRAINT "influencer_scores_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_scores" ADD CONSTRAINT "influencer_scores_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "grading_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_score_history" ADD CONSTRAINT "influencer_score_history_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_services" ADD CONSTRAINT "influencer_services_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencer_services" ADD CONSTRAINT "influencer_services_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "influencer_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_benchmarks" ADD CONSTRAINT "pricing_benchmarks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_benchmarks" ADD CONSTRAINT "pricing_benchmarks_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "service_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_history" ADD CONSTRAINT "pricing_history_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "influencer_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_influencers" ADD CONSTRAINT "saved_influencers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_influencers" ADD CONSTRAINT "saved_influencers_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_entitlements" ADD CONSTRAINT "contact_entitlements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_entitlements" ADD CONSTRAINT "contact_entitlements_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_entitlements" ADD CONSTRAINT "contact_entitlements_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "contact_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_purchases" ADD CONSTRAINT "contact_purchases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_purchases" ADD CONSTRAINT "contact_purchases_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "influencer_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "influencer_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contactPurchaseId_fkey" FOREIGN KEY ("contactPurchaseId") REFERENCES "contact_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "campaign_deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_deliverables" ADD CONSTRAINT "campaign_deliverables_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_approvals" ADD CONSTRAINT "campaign_approvals_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_approvals" ADD CONSTRAINT "campaign_approvals_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "campaign_deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_search_logs" ADD CONSTRAINT "ai_search_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_searchLogId_fkey" FOREIGN KEY ("searchLogId") REFERENCES "ai_search_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendation_feedback" ADD CONSTRAINT "ai_recommendation_feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ai_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
