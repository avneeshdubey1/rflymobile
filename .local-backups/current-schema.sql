--
-- PostgreSQL database dump
--

\restrict uhhH9Wgr7oAXjVFrrWfixDK77hp5p09OhCOKwdxTmyQpIMljhMCGLRcwljj0GGT

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AssetAvailabilityState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssetAvailabilityState" AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'UNAVAILABLE'
);


--
-- Name: AssetOperationalState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssetOperationalState" AS ENUM (
    'IN_SERVICE',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);


--
-- Name: CropSeason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CropSeason" AS ENUM (
    'KHARIF',
    'RABI',
    'SUMMER',
    'OTHER'
);


--
-- Name: DroneStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DroneStatus" AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);


--
-- Name: FarmLocationSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FarmLocationSource" AS ENUM (
    'STAFF_CAPTURED',
    'PUBLIC_WEBSITE',
    'IMPORTED_ZOHO',
    'IMPORTED_GOOGLE_FORMS'
);


--
-- Name: HistoricalServiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HistoricalServiceStatus" AS ENUM (
    'COMPLETED',
    'UNKNOWN',
    'CORRECTED'
);


--
-- Name: HistoryEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HistoryEventType" AS ENUM (
    'BASELINE',
    'CREATED',
    'UPDATED',
    'STATUS_CHANGED',
    'CORRECTED',
    'ARCHIVED',
    'IMPORTED'
);


--
-- Name: ImportBatchStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ImportBatchStatus" AS ENUM (
    'STAGED',
    'VALIDATED',
    'REVIEW_REQUIRED',
    'APPROVED',
    'IMPORTING',
    'COMPLETED',
    'FAILED',
    'ROLLED_BACK',
    'SUPERSEDED'
);


--
-- Name: ImportSourceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ImportSourceType" AS ENUM (
    'FARMER_WORKBOOK',
    'ZOHO_CRM',
    'GOOGLE_FORMS'
);


--
-- Name: IntakeChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IntakeChannel" AS ENUM (
    'WEBSITE',
    'MANUAL_SALES'
);


--
-- Name: LMVStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LMVStatus" AS ENUM (
    'AVAILABLE',
    'ASSIGNED',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);


--
-- Name: LanguageProficiency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LanguageProficiency" AS ENUM (
    'PRIMARY',
    'STRONG',
    'WORKING',
    'BASIC'
);


--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'NEW',
    'PROCESSED',
    'NEEDS_MANUAL_SCHEDULING',
    'MANUAL_CALL_REQUIRED',
    'SCHEDULED',
    'PILOT_ACCEPTED',
    'IN_PROGRESS',
    'COMPLETED',
    'FLAGGED',
    'CANCELLED',
    'REJECTED'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'PILOT_ASSIGNMENT',
    'PILOT_SMS',
    'DISPATCH_CALL_TASK',
    'RESCHEDULE',
    'DRONE_DECOMMISSIONED',
    'MISSION_FLAGGED',
    'MISSION_COMPLETED',
    'LEAD_PROCESSED',
    'NEEDS_MANUAL_SCHEDULING',
    'WEATHER_RISK',
    'PAYMENT_PENDING'
);


--
-- Name: OtpDeliveryChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OtpDeliveryChannel" AS ENUM (
    'DISABLED',
    'TEST',
    'CLI',
    'WHATSAPP',
    'SMS'
);


--
-- Name: OtpDeliveryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OtpDeliveryStatus" AS ENUM (
    'QUEUED',
    'SENT',
    'MOCKED',
    'FAILED',
    'DEAD_LETTER',
    'DISABLED'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'UPI',
    'CASH'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: PhoneVerificationPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PhoneVerificationPurpose" AS ENUM (
    'FARMER_PORTAL_AUTH',
    'FARMER_PHONE_LINK',
    'BUSINESS_RECOVERY'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'SALES',
    'FLEET_MANAGER',
    'PILOT',
    'FARMER',
    'BUSINESS'
);


--
-- Name: SourceRecordStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SourceRecordStatus" AS ENUM (
    'PENDING',
    'VALID',
    'REJECTED',
    'REVIEW_REQUIRED',
    'IMPORTED',
    'SKIPPED',
    'ROLLED_BACK'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'UNKNOWN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Assignment" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    "pilotId" text NOT NULL,
    "droneId" text NOT NULL,
    "scheduledDate" timestamp(3) without time zone NOT NULL,
    "autoAssigned" boolean DEFAULT true NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "weatherCheckedAt" timestamp(3) without time zone,
    "weatherSuitable" boolean,
    "weatherNote" text,
    "expectedAcreage" double precision NOT NULL,
    "actualAcreage" double precision,
    cost double precision,
    "hasDiscrepancy" boolean DEFAULT false NOT NULL,
    "discrepancyNote" text,
    "decommissionedMidMission" boolean DEFAULT false NOT NULL,
    "decommissionReason" text,
    "lastKnownLat" double precision,
    "lastKnownLng" double precision,
    "lastPingAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lmvId" text,
    "copilotDroneId" text,
    "copilotId" text,
    "dailySequence" integer DEFAULT 1 NOT NULL,
    "legacyCrewIncomplete" boolean DEFAULT false NOT NULL,
    "serviceWindowEnd" timestamp(3) without time zone,
    "serviceWindowStart" timestamp(3) without time zone
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    "actorId" text,
    "beforeState" jsonb,
    "afterState" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text
);


--
-- Name: AuthSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuthSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "csrfTokenHash" text NOT NULL,
    "authVersion" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "idleExpiresAt" timestamp(3) without time zone NOT NULL,
    "absoluteExpiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokeReason" text
);


--
-- Name: BusinessMembership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessMembership" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BusinessOrganization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BusinessOrganization" (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    "gstNo" text,
    address text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "senderId" text NOT NULL,
    content text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone
);


--
-- Name: ChatSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatSession" (
    id text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "firstResponseReadAt" timestamp(3) without time zone,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "leadId" text
);


--
-- Name: Crop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Crop" (
    id text NOT NULL,
    code character varying(40) NOT NULL,
    "displayName" character varying(120) NOT NULL,
    "normalizedName" character varying(120) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "displayName" text NOT NULL,
    phone text NOT NULL,
    "preferredLanguage" text DEFAULT 'ta'::text NOT NULL,
    village text,
    district text,
    "farmerUserId" text,
    "createdByUserId" text,
    "staffConfirmedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdByImportBatchId" text,
    "kharifAcres" double precision,
    "kharifCrop" text,
    "kharifOtherCrop" text,
    "kharifSprayings" integer,
    "kharifTanks" double precision,
    mandal text,
    ownership text,
    "rabiAcres" double precision,
    "rabiCrop" text,
    "rabiOtherCrop" text,
    "rabiSprayings" integer,
    "rabiTanks" double precision,
    remarks text,
    state text,
    "subscriptionCardNumber" text,
    "subscriptionYear" text,
    "summerAcres" double precision,
    "summerCrop" text,
    "summerOtherCrop" text,
    "summerSprayings" integer,
    "summerTanks" double precision,
    "totalAcres" double precision
);


--
-- Name: CustomerHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerHistory" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    version integer NOT NULL,
    "eventType" public."HistoryEventType" NOT NULL,
    "changedFields" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "actorUserId" text,
    reason character varying(500),
    "effectiveAt" timestamp(3) without time zone,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CustomerLanguagePreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerLanguagePreference" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "languageId" text NOT NULL,
    rank integer NOT NULL,
    proficiency public."LanguageProficiency" DEFAULT 'WORKING'::public."LanguageProficiency" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CustomerSeasonalCrop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerSeasonalCrop" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "cropId" text NOT NULL,
    season public."CropSeason" NOT NULL,
    "seasonYear" integer,
    acreage numeric(12,2),
    "tankQuantity" numeric(12,2),
    "expectedSprayings" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CustomerSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerSubscription" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "cardNumber" character varying(80),
    "schemeCode" character varying(80),
    status public."SubscriptionStatus" DEFAULT 'UNKNOWN'::public."SubscriptionStatus" NOT NULL,
    "validFrom" date,
    "validUntil" date,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DeclinedEnquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeclinedEnquiry" (
    id text NOT NULL,
    "contactName" text NOT NULL,
    "contactPhone" text NOT NULL,
    "sourceChannel" public."IntakeChannel" NOT NULL,
    reason text DEFAULT 'OUTSIDE_SERVICE_AREA'::text NOT NULL,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Drone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Drone" (
    id text NOT NULL,
    model text NOT NULL,
    "serialNumber" text NOT NULL,
    status public."DroneStatus" DEFAULT 'AVAILABLE'::public."DroneStatus" NOT NULL,
    "homeCenterId" text NOT NULL,
    "airworthinessExpiry" timestamp(3) without time zone,
    "lastMaintained" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "availabilityState" public."AssetAvailabilityState" DEFAULT 'AVAILABLE'::public."AssetAvailabilityState" NOT NULL,
    "batteryCapacity" integer,
    "batteryCapacityMah" integer,
    category text,
    certified boolean DEFAULT false NOT NULL,
    endurance integer,
    "enduranceMinutes" integer,
    location text,
    manufacturer text,
    name text,
    "operationalState" public."AssetOperationalState" DEFAULT 'IN_SERVICE'::public."AssetOperationalState" NOT NULL,
    "serviceType" text,
    "tankCapacity" double precision,
    "tankCapacityLitres" double precision,
    type text,
    uin text
);


--
-- Name: DroneHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DroneHistory" (
    id text NOT NULL,
    "droneId" text NOT NULL,
    version integer NOT NULL,
    "eventType" public."HistoryEventType" NOT NULL,
    "changedFields" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "actorUserId" text,
    reason character varying(500),
    "effectiveAt" timestamp(3) without time zone,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FarmLocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FarmLocation" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "administrativeLocationId" text,
    label character varying(120),
    "addressText" character varying(500),
    "plusCode" character varying(20),
    latitude numeric(10,7),
    longitude numeric(10,7),
    "accuracyMeters" numeric(10,2),
    source public."FarmLocationSource" NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedByUserId" text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: HistoricalServiceRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HistoricalServiceRecord" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "sourceRecordId" text NOT NULL,
    "farmLocationId" text,
    "cropId" text,
    "operatingCenterId" text,
    "serviceDate" date,
    "rawCropName" character varying(160),
    "servicedAcres" numeric(12,2),
    "legacyZone" character varying(160),
    status public."HistoricalServiceStatus" DEFAULT 'COMPLETED'::public."HistoricalServiceStatus" NOT NULL,
    notes character varying(1000),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ImportBatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ImportBatch" (
    id text NOT NULL,
    "sourceType" public."ImportSourceType" NOT NULL,
    "originalFileName" character varying(255) NOT NULL,
    "fileSizeBytes" bigint NOT NULL,
    "workbookType" character varying(20) DEFAULT 'XLSX'::character varying NOT NULL,
    "fileChecksum" character(64) NOT NULL,
    "mappingVersion" character varying(80) NOT NULL,
    "attemptNumber" integer DEFAULT 1 NOT NULL,
    "supersedesBatchId" text,
    "dryRunPlanHash" character(64),
    "referenceDataFingerprint" character(64),
    "approvalReference" character varying(160),
    "backupEvidenceReference" character varying(160),
    "expectedDeploymentName" character varying(120),
    "reconciliationChecksum" character(64),
    status public."ImportBatchStatus" DEFAULT 'STAGED'::public."ImportBatchStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "validRows" integer DEFAULT 0 NOT NULL,
    "rejectedRows" integer DEFAULT 0 NOT NULL,
    "reviewRows" integer DEFAULT 0 NOT NULL,
    "importedRows" integer DEFAULT 0 NOT NULL,
    "skippedRows" integer DEFAULT 0 NOT NULL,
    "safeReport" jsonb,
    "rawRetentionUntil" timestamp(3) without time zone NOT NULL,
    "createdByUserId" text,
    "approvedByUserId" text,
    "approvedAt" timestamp(3) without time zone,
    "importStartedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "reconciledAt" timestamp(3) without time zone,
    "rolledBackAt" timestamp(3) without time zone,
    "failureCode" character varying(80),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LMV; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LMV" (
    id text NOT NULL,
    "registrationNo" text NOT NULL,
    label text,
    status public."LMVStatus" DEFAULT 'AVAILABLE'::public."LMVStatus" NOT NULL,
    "homeCenterId" text NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "availabilityState" public."AssetAvailabilityState" DEFAULT 'AVAILABLE'::public."AssetAvailabilityState" NOT NULL,
    "operationalState" public."AssetOperationalState" DEFAULT 'IN_SERVICE'::public."AssetOperationalState" NOT NULL
);


--
-- Name: LMVHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LMVHistory" (
    id text NOT NULL,
    "lmvId" text NOT NULL,
    version integer NOT NULL,
    "eventType" public."HistoryEventType" NOT NULL,
    "changedFields" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "actorUserId" text,
    reason character varying(500),
    "effectiveAt" timestamp(3) without time zone,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Language; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Language" (
    id text NOT NULL,
    code character varying(12) NOT NULL,
    "displayName" character varying(80) NOT NULL,
    "nativeName" character varying(80),
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lead" (
    id text NOT NULL,
    "farmerName" text NOT NULL,
    "farmerPhone" text NOT NULL,
    "farmerAddress" text,
    latitude double precision,
    longitude double precision,
    acreage double precision NOT NULL,
    "cropType" text,
    notes text,
    "preferredLanguage" text DEFAULT 'ta'::text NOT NULL,
    status public."LeadStatus" DEFAULT 'NEW'::public."LeadStatus" NOT NULL,
    "intakeChannel" public."IntakeChannel" NOT NULL,
    "matchedCenterId" text,
    "distanceFromCenterKm" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "chemicalBrand" text,
    "chemicalProofUrl" text,
    "cropAgeWeeks" integer,
    "expectedDate" timestamp(3) without time zone,
    "expectedTime" text,
    "hasChemical" boolean DEFAULT true NOT NULL,
    "soilType" text,
    "sprayPurpose" text,
    "terrainType" text,
    "waterBodyNearby" boolean DEFAULT false NOT NULL,
    "customerId" text,
    "businessOrganizationId" text,
    "acreageDecimal" numeric(12,2),
    "cropId" text,
    "farmLocationId" text
);


--
-- Name: LeadHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeadHistory" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    version integer NOT NULL,
    "eventType" public."HistoryEventType" NOT NULL,
    "changedFields" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "actorUserId" text,
    reason character varying(500),
    "effectiveAt" timestamp(3) without time zone,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LeadSprayPurpose; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeadSprayPurpose" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    "purposeCode" character varying(80) NOT NULL,
    "labelSnapshot" character varying(160),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Location" (
    id text NOT NULL,
    "countryCode" character varying(2) DEFAULT 'IN'::character varying NOT NULL,
    state character varying(120),
    district character varying(120),
    mandal character varying(120),
    village character varying(160),
    "postalCode" character varying(20),
    "normalizedKey" character varying(640) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type public."NotificationType" NOT NULL,
    "recipientId" text NOT NULL,
    "leadId" text,
    message text NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NotificationEscalation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationEscalation" (
    id text NOT NULL,
    "assignmentId" text NOT NULL,
    stage text DEFAULT 'PUSH_SENT'::text NOT NULL,
    "nextActionAt" timestamp(3) without time zone NOT NULL,
    "reassignCount" integer DEFAULT 0 NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OperatingCenter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OperatingCenter" (
    id text NOT NULL,
    name text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    "radiusKm" double precision DEFAULT 50 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "administrativeLocationId" text,
    code text,
    "plusCode" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OtpDeliveryOutbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OtpDeliveryOutbox" (
    id text NOT NULL,
    "challengeId" text NOT NULL,
    channel public."OtpDeliveryChannel" NOT NULL,
    status public."OtpDeliveryStatus" DEFAULT 'QUEUED'::public."OtpDeliveryStatus" NOT NULL,
    "idempotencyKey" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "nextAttemptAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processedAt" timestamp(3) without time zone,
    "lastError" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PasswordRecoveryChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordRecoveryChallenge" (
    id text NOT NULL,
    "userId" text,
    "identifierHash" text NOT NULL,
    channel text NOT NULL,
    "deliveryStatus" text NOT NULL,
    "codeHash" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 5 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedAuthVersion" integer,
    "externalProofHash" text
);


--
-- Name: PaymentRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentRecord" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    "assignmentId" text NOT NULL,
    amount double precision NOT NULL,
    method public."PaymentMethod" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "upiLink" text,
    "upiTransactionId" text,
    "markedCashBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone
);


--
-- Name: PhoneVerificationChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PhoneVerificationChallenge" (
    id text NOT NULL,
    "userId" text,
    "customerId" text,
    "phoneHash" text NOT NULL,
    "recipientLast4" text,
    purpose public."PhoneVerificationPurpose" NOT NULL,
    "codeHash" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 5 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "resendAvailableAt" timestamp(3) without time zone NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PricingConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PricingConfig" (
    id text NOT NULL,
    key text NOT NULL,
    value double precision NOT NULL,
    "updatedBy" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ScheduleChangeLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduleChangeLog" (
    id text NOT NULL,
    "assignmentId" text NOT NULL,
    "oldDate" timestamp(3) without time zone NOT NULL,
    "newDate" timestamp(3) without time zone NOT NULL,
    "changedBy" text NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SourceRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SourceRecord" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    "sourceSystem" public."ImportSourceType" NOT NULL,
    "sheetName" character varying(120) NOT NULL,
    "sourceRowNumber" integer NOT NULL,
    "externalRecordId" character varying(160),
    "rowFingerprint" character(64) NOT NULL,
    "phoneFingerprint" character(64),
    "recipientLast4" character varying(4),
    status public."SourceRecordStatus" DEFAULT 'PENDING'::public."SourceRecordStatus" NOT NULL,
    "reasonCode" character varying(80),
    "safeDetails" jsonb,
    "proposedOutcome" character varying(80),
    "finalOutcome" character varying(80),
    "encryptedPayload" bytea NOT NULL,
    "payloadIv" bytea NOT NULL,
    "payloadAuthTag" bytea NOT NULL,
    "encryptionKeyVersion" character varying(40) NOT NULL,
    "payloadExpiresAt" timestamp(3) without time zone NOT NULL,
    "customerId" text,
    "resultEntityType" character varying(80),
    "resultEntityId" text,
    "committedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    "passwordHash" text NOT NULL,
    role public."Role" NOT NULL,
    "preferredLanguage" text DEFAULT 'ta'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "homeCenterId" text,
    "pilotLicenseExpiry" timestamp(3) without time zone,
    active boolean DEFAULT true NOT NULL,
    "authVersion" integer DEFAULT 1 NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "phoneVerifiedAt" timestamp(3) without time zone,
    "archivedAt" timestamp(3) without time zone,
    district text,
    village text,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    address text,
    "businessName" text,
    "contactPerson" text,
    "gstNo" text,
    "addressLine1" text,
    "addressLine2" text,
    "assignedDroneId" text,
    city text,
    "employeeCode" text,
    "idProof" text,
    "licenseId" text,
    pincode text,
    state text,
    CONSTRAINT "User_phone_canonical_check" CHECK (((phone IS NULL) OR (phone ~ '^[+][0-9]{8,15}$'::text)))
);


--
-- Name: VerificationDeliveryAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationDeliveryAttempt" (
    id text NOT NULL,
    "challengeId" text NOT NULL,
    channel public."OtpDeliveryChannel" NOT NULL,
    status public."OtpDeliveryStatus" NOT NULL,
    "providerReference" text,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: VillageVisit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VillageVisit" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "sourceRecordId" text NOT NULL,
    "collectorUserId" text,
    "collectorNameRaw" character varying(160),
    "employeeCodeRaw" character varying(80),
    "administrativeLocationId" text,
    "cropId" text,
    "visitedAt" timestamp(3) without time zone,
    "rawCropName" character varying(160),
    "observedAcres" numeric(12,2),
    "fertilizerShop" character varying(240),
    "expectedSpraying" character varying(240),
    "farmerType" character varying(80),
    notes character varying(1000),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _ChatParticipants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_ChatParticipants" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: Assignment Assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: AuthSession AuthSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthSession"
    ADD CONSTRAINT "AuthSession_pkey" PRIMARY KEY (id);


--
-- Name: BusinessMembership BusinessMembership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessMembership"
    ADD CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY (id);


--
-- Name: BusinessOrganization BusinessOrganization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessOrganization"
    ADD CONSTRAINT "BusinessOrganization_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: ChatSession ChatSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_pkey" PRIMARY KEY (id);


--
-- Name: Crop Crop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Crop"
    ADD CONSTRAINT "Crop_pkey" PRIMARY KEY (id);


--
-- Name: CustomerHistory CustomerHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerHistory"
    ADD CONSTRAINT "CustomerHistory_pkey" PRIMARY KEY (id);


--
-- Name: CustomerLanguagePreference CustomerLanguagePreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerLanguagePreference"
    ADD CONSTRAINT "CustomerLanguagePreference_pkey" PRIMARY KEY (id);


--
-- Name: CustomerSeasonalCrop CustomerSeasonalCrop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerSeasonalCrop"
    ADD CONSTRAINT "CustomerSeasonalCrop_pkey" PRIMARY KEY (id);


--
-- Name: CustomerSubscription CustomerSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerSubscription"
    ADD CONSTRAINT "CustomerSubscription_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: DeclinedEnquiry DeclinedEnquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeclinedEnquiry"
    ADD CONSTRAINT "DeclinedEnquiry_pkey" PRIMARY KEY (id);


--
-- Name: DroneHistory DroneHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DroneHistory"
    ADD CONSTRAINT "DroneHistory_pkey" PRIMARY KEY (id);


--
-- Name: Drone Drone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Drone"
    ADD CONSTRAINT "Drone_pkey" PRIMARY KEY (id);


--
-- Name: FarmLocation FarmLocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmLocation"
    ADD CONSTRAINT "FarmLocation_pkey" PRIMARY KEY (id);


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_pkey" PRIMARY KEY (id);


--
-- Name: ImportBatch ImportBatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_pkey" PRIMARY KEY (id);


--
-- Name: LMVHistory LMVHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LMVHistory"
    ADD CONSTRAINT "LMVHistory_pkey" PRIMARY KEY (id);


--
-- Name: LMV LMV_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LMV"
    ADD CONSTRAINT "LMV_pkey" PRIMARY KEY (id);


--
-- Name: Language Language_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Language"
    ADD CONSTRAINT "Language_pkey" PRIMARY KEY (id);


--
-- Name: LeadHistory LeadHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadHistory"
    ADD CONSTRAINT "LeadHistory_pkey" PRIMARY KEY (id);


--
-- Name: LeadSprayPurpose LeadSprayPurpose_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadSprayPurpose"
    ADD CONSTRAINT "LeadSprayPurpose_pkey" PRIMARY KEY (id);


--
-- Name: Lead Lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_pkey" PRIMARY KEY (id);


--
-- Name: Location Location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Location"
    ADD CONSTRAINT "Location_pkey" PRIMARY KEY (id);


--
-- Name: NotificationEscalation NotificationEscalation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationEscalation"
    ADD CONSTRAINT "NotificationEscalation_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OperatingCenter OperatingCenter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OperatingCenter"
    ADD CONSTRAINT "OperatingCenter_pkey" PRIMARY KEY (id);


--
-- Name: OtpDeliveryOutbox OtpDeliveryOutbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OtpDeliveryOutbox"
    ADD CONSTRAINT "OtpDeliveryOutbox_pkey" PRIMARY KEY (id);


--
-- Name: PasswordRecoveryChallenge PasswordRecoveryChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordRecoveryChallenge"
    ADD CONSTRAINT "PasswordRecoveryChallenge_pkey" PRIMARY KEY (id);


--
-- Name: PaymentRecord PaymentRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY (id);


--
-- Name: PhoneVerificationChallenge PhoneVerificationChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PhoneVerificationChallenge"
    ADD CONSTRAINT "PhoneVerificationChallenge_pkey" PRIMARY KEY (id);


--
-- Name: PricingConfig PricingConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PricingConfig"
    ADD CONSTRAINT "PricingConfig_pkey" PRIMARY KEY (id);


--
-- Name: ScheduleChangeLog ScheduleChangeLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleChangeLog"
    ADD CONSTRAINT "ScheduleChangeLog_pkey" PRIMARY KEY (id);


--
-- Name: SourceRecord SourceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourceRecord"
    ADD CONSTRAINT "SourceRecord_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VerificationDeliveryAttempt VerificationDeliveryAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationDeliveryAttempt"
    ADD CONSTRAINT "VerificationDeliveryAttempt_pkey" PRIMARY KEY (id);


--
-- Name: VillageVisit VillageVisit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_pkey" PRIMARY KEY (id);


--
-- Name: Assignment_copilotId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_copilotId_scheduledDate_idx" ON public."Assignment" USING btree ("copilotId", "scheduledDate");


--
-- Name: Assignment_droneId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_droneId_scheduledDate_idx" ON public."Assignment" USING btree ("droneId", "scheduledDate");


--
-- Name: Assignment_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Assignment_leadId_key" ON public."Assignment" USING btree ("leadId");


--
-- Name: Assignment_lmvId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_lmvId_scheduledDate_idx" ON public."Assignment" USING btree ("lmvId", "scheduledDate");


--
-- Name: Assignment_pilotId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_pilotId_scheduledDate_idx" ON public."Assignment" USING btree ("pilotId", "scheduledDate");


--
-- Name: Assignment_scheduledDate_dailySequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_scheduledDate_dailySequence_idx" ON public."Assignment" USING btree ("scheduledDate", "dailySequence");


--
-- Name: AuditLog_entityType_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON public."AuditLog" USING btree ("entityType", "entityId", "createdAt");


--
-- Name: AuthSession_idleExpiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthSession_idleExpiresAt_idx" ON public."AuthSession" USING btree ("idleExpiresAt");


--
-- Name: AuthSession_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON public."AuthSession" USING btree ("tokenHash");


--
-- Name: AuthSession_userId_revokedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuthSession_userId_revokedAt_idx" ON public."AuthSession" USING btree ("userId", "revokedAt");


--
-- Name: BusinessMembership_organizationId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessMembership_organizationId_active_idx" ON public."BusinessMembership" USING btree ("organizationId", active);


--
-- Name: BusinessMembership_organizationId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BusinessMembership_organizationId_userId_key" ON public."BusinessMembership" USING btree ("organizationId", "userId");


--
-- Name: BusinessMembership_userId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessMembership_userId_active_idx" ON public."BusinessMembership" USING btree ("userId", active);


--
-- Name: BusinessOrganization_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessOrganization_active_idx" ON public."BusinessOrganization" USING btree (active);


--
-- Name: BusinessOrganization_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BusinessOrganization_name_idx" ON public."BusinessOrganization" USING btree (name);


--
-- Name: Crop_active_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Crop_active_displayName_idx" ON public."Crop" USING btree (active, "displayName");


--
-- Name: Crop_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Crop_code_key" ON public."Crop" USING btree (code);


--
-- Name: Crop_normalizedName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Crop_normalizedName_key" ON public."Crop" USING btree ("normalizedName");


--
-- Name: CustomerHistory_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerHistory_actorUserId_idx" ON public."CustomerHistory" USING btree ("actorUserId");


--
-- Name: CustomerHistory_customerId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerHistory_customerId_recordedAt_idx" ON public."CustomerHistory" USING btree ("customerId", "recordedAt");


--
-- Name: CustomerHistory_customerId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerHistory_customerId_version_key" ON public."CustomerHistory" USING btree ("customerId", version);


--
-- Name: CustomerLanguagePreference_customerId_languageId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerLanguagePreference_customerId_languageId_key" ON public."CustomerLanguagePreference" USING btree ("customerId", "languageId");


--
-- Name: CustomerLanguagePreference_customerId_rank_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerLanguagePreference_customerId_rank_key" ON public."CustomerLanguagePreference" USING btree ("customerId", rank);


--
-- Name: CustomerLanguagePreference_languageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerLanguagePreference_languageId_idx" ON public."CustomerLanguagePreference" USING btree ("languageId");


--
-- Name: CustomerSeasonalCrop_cropId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerSeasonalCrop_cropId_idx" ON public."CustomerSeasonalCrop" USING btree ("cropId");


--
-- Name: CustomerSeasonalCrop_customerId_season_seasonYear_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerSeasonalCrop_customerId_season_seasonYear_idx" ON public."CustomerSeasonalCrop" USING btree ("customerId", season, "seasonYear");


--
-- Name: CustomerSubscription_cardNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerSubscription_cardNumber_key" ON public."CustomerSubscription" USING btree ("cardNumber");


--
-- Name: CustomerSubscription_customerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerSubscription_customerId_status_idx" ON public."CustomerSubscription" USING btree ("customerId", status);


--
-- Name: Customer_active_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_active_updatedAt_idx" ON public."Customer" USING btree (active, "updatedAt");


--
-- Name: Customer_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_createdAt_idx" ON public."Customer" USING btree ("createdAt");


--
-- Name: Customer_createdByImportBatchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_createdByImportBatchId_idx" ON public."Customer" USING btree ("createdByImportBatchId");


--
-- Name: Customer_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_displayName_idx" ON public."Customer" USING btree ("displayName");


--
-- Name: Customer_farmerUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Customer_farmerUserId_key" ON public."Customer" USING btree ("farmerUserId");


--
-- Name: Customer_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Customer_phone_key" ON public."Customer" USING btree (phone);


--
-- Name: DeclinedEnquiry_contactPhone_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeclinedEnquiry_contactPhone_createdAt_idx" ON public."DeclinedEnquiry" USING btree ("contactPhone", "createdAt");


--
-- Name: DeclinedEnquiry_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeclinedEnquiry_expiresAt_idx" ON public."DeclinedEnquiry" USING btree ("expiresAt");


--
-- Name: DroneHistory_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DroneHistory_actorUserId_idx" ON public."DroneHistory" USING btree ("actorUserId");


--
-- Name: DroneHistory_droneId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DroneHistory_droneId_recordedAt_idx" ON public."DroneHistory" USING btree ("droneId", "recordedAt");


--
-- Name: DroneHistory_droneId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DroneHistory_droneId_version_key" ON public."DroneHistory" USING btree ("droneId", version);


--
-- Name: Drone_homeCenterId_archivedAt_operationalState_availability_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Drone_homeCenterId_archivedAt_operationalState_availability_idx" ON public."Drone" USING btree ("homeCenterId", "archivedAt", "operationalState", "availabilityState");


--
-- Name: Drone_serialNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Drone_serialNumber_key" ON public."Drone" USING btree ("serialNumber");


--
-- Name: Drone_uin_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Drone_uin_key" ON public."Drone" USING btree (uin);


--
-- Name: FarmLocation_administrativeLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmLocation_administrativeLocationId_idx" ON public."FarmLocation" USING btree ("administrativeLocationId");


--
-- Name: FarmLocation_customerId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmLocation_customerId_active_idx" ON public."FarmLocation" USING btree ("customerId", active);


--
-- Name: FarmLocation_plusCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmLocation_plusCode_idx" ON public."FarmLocation" USING btree ("plusCode");


--
-- Name: FarmLocation_verifiedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FarmLocation_verifiedByUserId_idx" ON public."FarmLocation" USING btree ("verifiedByUserId");


--
-- Name: HistoricalServiceRecord_cropId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HistoricalServiceRecord_cropId_idx" ON public."HistoricalServiceRecord" USING btree ("cropId");


--
-- Name: HistoricalServiceRecord_customerId_serviceDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HistoricalServiceRecord_customerId_serviceDate_idx" ON public."HistoricalServiceRecord" USING btree ("customerId", "serviceDate");


--
-- Name: HistoricalServiceRecord_farmLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HistoricalServiceRecord_farmLocationId_idx" ON public."HistoricalServiceRecord" USING btree ("farmLocationId");


--
-- Name: HistoricalServiceRecord_operatingCenterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HistoricalServiceRecord_operatingCenterId_idx" ON public."HistoricalServiceRecord" USING btree ("operatingCenterId");


--
-- Name: HistoricalServiceRecord_sourceRecordId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HistoricalServiceRecord_sourceRecordId_key" ON public."HistoricalServiceRecord" USING btree ("sourceRecordId");


--
-- Name: ImportBatch_approvedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_approvedByUserId_idx" ON public."ImportBatch" USING btree ("approvedByUserId");


--
-- Name: ImportBatch_createdByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_createdByUserId_idx" ON public."ImportBatch" USING btree ("createdByUserId");


--
-- Name: ImportBatch_fileChecksum_mappingVersion_attemptNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ImportBatch_fileChecksum_mappingVersion_attemptNumber_key" ON public."ImportBatch" USING btree ("fileChecksum", "mappingVersion", "attemptNumber");


--
-- Name: ImportBatch_rawRetentionUntil_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_rawRetentionUntil_idx" ON public."ImportBatch" USING btree ("rawRetentionUntil");


--
-- Name: ImportBatch_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_status_createdAt_idx" ON public."ImportBatch" USING btree (status, "createdAt");


--
-- Name: ImportBatch_supersedesBatchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImportBatch_supersedesBatchId_idx" ON public."ImportBatch" USING btree ("supersedesBatchId");


--
-- Name: LMVHistory_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LMVHistory_actorUserId_idx" ON public."LMVHistory" USING btree ("actorUserId");


--
-- Name: LMVHistory_lmvId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LMVHistory_lmvId_recordedAt_idx" ON public."LMVHistory" USING btree ("lmvId", "recordedAt");


--
-- Name: LMVHistory_lmvId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LMVHistory_lmvId_version_key" ON public."LMVHistory" USING btree ("lmvId", version);


--
-- Name: LMV_homeCenterId_operationalState_availabilityState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LMV_homeCenterId_operationalState_availabilityState_idx" ON public."LMV" USING btree ("homeCenterId", "operationalState", "availabilityState");


--
-- Name: LMV_homeCenterId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LMV_homeCenterId_status_idx" ON public."LMV" USING btree ("homeCenterId", status);


--
-- Name: LMV_registrationNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LMV_registrationNo_key" ON public."LMV" USING btree ("registrationNo");


--
-- Name: Language_active_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Language_active_displayName_idx" ON public."Language" USING btree (active, "displayName");


--
-- Name: Language_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Language_code_key" ON public."Language" USING btree (code);


--
-- Name: LeadHistory_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadHistory_actorUserId_idx" ON public."LeadHistory" USING btree ("actorUserId");


--
-- Name: LeadHistory_leadId_recordedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadHistory_leadId_recordedAt_idx" ON public."LeadHistory" USING btree ("leadId", "recordedAt");


--
-- Name: LeadHistory_leadId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadHistory_leadId_version_key" ON public."LeadHistory" USING btree ("leadId", version);


--
-- Name: LeadSprayPurpose_leadId_purposeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeadSprayPurpose_leadId_purposeCode_key" ON public."LeadSprayPurpose" USING btree ("leadId", "purposeCode");


--
-- Name: LeadSprayPurpose_purposeCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadSprayPurpose_purposeCode_idx" ON public."LeadSprayPurpose" USING btree ("purposeCode");


--
-- Name: Lead_businessOrganizationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_businessOrganizationId_createdAt_idx" ON public."Lead" USING btree ("businessOrganizationId", "createdAt");


--
-- Name: Lead_cropId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_cropId_createdAt_idx" ON public."Lead" USING btree ("cropId", "createdAt");


--
-- Name: Lead_customerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_customerId_createdAt_idx" ON public."Lead" USING btree ("customerId", "createdAt");


--
-- Name: Lead_farmLocationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_farmLocationId_createdAt_idx" ON public."Lead" USING btree ("farmLocationId", "createdAt");


--
-- Name: Location_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Location_active_idx" ON public."Location" USING btree (active);


--
-- Name: Location_countryCode_state_district_mandal_village_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Location_countryCode_state_district_mandal_village_idx" ON public."Location" USING btree ("countryCode", state, district, mandal, village);


--
-- Name: Location_normalizedKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Location_normalizedKey_key" ON public."Location" USING btree ("normalizedKey");


--
-- Name: NotificationEscalation_assignmentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationEscalation_assignmentId_key" ON public."NotificationEscalation" USING btree ("assignmentId");


--
-- Name: NotificationEscalation_nextActionAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationEscalation_nextActionAt_idx" ON public."NotificationEscalation" USING btree ("nextActionAt");


--
-- Name: OperatingCenter_administrativeLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OperatingCenter_administrativeLocationId_idx" ON public."OperatingCenter" USING btree ("administrativeLocationId");


--
-- Name: OperatingCenter_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OperatingCenter_code_key" ON public."OperatingCenter" USING btree (code);


--
-- Name: OtpDeliveryOutbox_challengeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OtpDeliveryOutbox_challengeId_idx" ON public."OtpDeliveryOutbox" USING btree ("challengeId");


--
-- Name: OtpDeliveryOutbox_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OtpDeliveryOutbox_idempotencyKey_key" ON public."OtpDeliveryOutbox" USING btree ("idempotencyKey");


--
-- Name: OtpDeliveryOutbox_status_nextAttemptAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OtpDeliveryOutbox_status_nextAttemptAt_idx" ON public."OtpDeliveryOutbox" USING btree (status, "nextAttemptAt");


--
-- Name: PasswordRecoveryChallenge_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordRecoveryChallenge_expiresAt_idx" ON public."PasswordRecoveryChallenge" USING btree ("expiresAt");


--
-- Name: PasswordRecoveryChallenge_externalProofHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordRecoveryChallenge_externalProofHash_key" ON public."PasswordRecoveryChallenge" USING btree ("externalProofHash");


--
-- Name: PasswordRecoveryChallenge_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordRecoveryChallenge_userId_createdAt_idx" ON public."PasswordRecoveryChallenge" USING btree ("userId", "createdAt");


--
-- Name: PhoneVerificationChallenge_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PhoneVerificationChallenge_expiresAt_idx" ON public."PhoneVerificationChallenge" USING btree ("expiresAt");


--
-- Name: PhoneVerificationChallenge_phoneHash_purpose_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PhoneVerificationChallenge_phoneHash_purpose_createdAt_idx" ON public."PhoneVerificationChallenge" USING btree ("phoneHash", purpose, "createdAt");


--
-- Name: PhoneVerificationChallenge_userId_purpose_revokedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PhoneVerificationChallenge_userId_purpose_revokedAt_idx" ON public."PhoneVerificationChallenge" USING btree ("userId", purpose, "revokedAt");


--
-- Name: PricingConfig_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PricingConfig_key_key" ON public."PricingConfig" USING btree (key);


--
-- Name: SourceRecord_batchId_sheetName_sourceRowNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SourceRecord_batchId_sheetName_sourceRowNumber_key" ON public."SourceRecord" USING btree ("batchId", "sheetName", "sourceRowNumber");


--
-- Name: SourceRecord_batchId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_batchId_status_idx" ON public."SourceRecord" USING btree ("batchId", status);


--
-- Name: SourceRecord_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_customerId_idx" ON public."SourceRecord" USING btree ("customerId");


--
-- Name: SourceRecord_payloadExpiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_payloadExpiresAt_idx" ON public."SourceRecord" USING btree ("payloadExpiresAt");


--
-- Name: SourceRecord_phoneFingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_phoneFingerprint_idx" ON public."SourceRecord" USING btree ("phoneFingerprint");


--
-- Name: SourceRecord_rowFingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_rowFingerprint_idx" ON public."SourceRecord" USING btree ("rowFingerprint");


--
-- Name: SourceRecord_sourceSystem_externalRecordId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceRecord_sourceSystem_externalRecordId_idx" ON public."SourceRecord" USING btree ("sourceSystem", "externalRecordId");


--
-- Name: User_assignedDroneId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_assignedDroneId_key" ON public."User" USING btree ("assignedDroneId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_employeeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_employeeCode_key" ON public."User" USING btree ("employeeCode");


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: VerificationDeliveryAttempt_challengeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VerificationDeliveryAttempt_challengeId_createdAt_idx" ON public."VerificationDeliveryAttempt" USING btree ("challengeId", "createdAt");


--
-- Name: VillageVisit_administrativeLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VillageVisit_administrativeLocationId_idx" ON public."VillageVisit" USING btree ("administrativeLocationId");


--
-- Name: VillageVisit_collectorUserId_visitedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VillageVisit_collectorUserId_visitedAt_idx" ON public."VillageVisit" USING btree ("collectorUserId", "visitedAt");


--
-- Name: VillageVisit_cropId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VillageVisit_cropId_idx" ON public."VillageVisit" USING btree ("cropId");


--
-- Name: VillageVisit_customerId_visitedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VillageVisit_customerId_visitedAt_idx" ON public."VillageVisit" USING btree ("customerId", "visitedAt");


--
-- Name: VillageVisit_sourceRecordId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VillageVisit_sourceRecordId_key" ON public."VillageVisit" USING btree ("sourceRecordId");


--
-- Name: _ChatParticipants_AB_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "_ChatParticipants_AB_unique" ON public."_ChatParticipants" USING btree ("A", "B");


--
-- Name: _ChatParticipants_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_ChatParticipants_B_index" ON public."_ChatParticipants" USING btree ("B");


--
-- Name: Assignment Assignment_copilotDroneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_copilotDroneId_fkey" FOREIGN KEY ("copilotDroneId") REFERENCES public."Drone"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Assignment Assignment_copilotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_copilotId_fkey" FOREIGN KEY ("copilotId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Assignment Assignment_droneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES public."Drone"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Assignment Assignment_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Assignment Assignment_lmvId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_lmvId_fkey" FOREIGN KEY ("lmvId") REFERENCES public."LMV"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Assignment Assignment_pilotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AuthSession AuthSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuthSession"
    ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessMembership BusinessMembership_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessMembership"
    ADD CONSTRAINT "BusinessMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."BusinessOrganization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BusinessMembership BusinessMembership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BusinessMembership"
    ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."ChatSession"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChatSession ChatSession_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CustomerHistory CustomerHistory_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerHistory"
    ADD CONSTRAINT "CustomerHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerHistory CustomerHistory_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerHistory"
    ADD CONSTRAINT "CustomerHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerLanguagePreference CustomerLanguagePreference_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerLanguagePreference"
    ADD CONSTRAINT "CustomerLanguagePreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomerLanguagePreference CustomerLanguagePreference_languageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerLanguagePreference"
    ADD CONSTRAINT "CustomerLanguagePreference_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES public."Language"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerSeasonalCrop CustomerSeasonalCrop_cropId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerSeasonalCrop"
    ADD CONSTRAINT "CustomerSeasonalCrop_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES public."Crop"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CustomerSeasonalCrop CustomerSeasonalCrop_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerSeasonalCrop"
    ADD CONSTRAINT "CustomerSeasonalCrop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomerSubscription CustomerSubscription_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerSubscription"
    ADD CONSTRAINT "CustomerSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Customer Customer_createdByImportBatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_createdByImportBatchId_fkey" FOREIGN KEY ("createdByImportBatchId") REFERENCES public."ImportBatch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Customer Customer_farmerUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DroneHistory DroneHistory_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DroneHistory"
    ADD CONSTRAINT "DroneHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DroneHistory DroneHistory_droneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DroneHistory"
    ADD CONSTRAINT "DroneHistory_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES public."Drone"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Drone Drone_homeCenterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Drone"
    ADD CONSTRAINT "Drone_homeCenterId_fkey" FOREIGN KEY ("homeCenterId") REFERENCES public."OperatingCenter"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: FarmLocation FarmLocation_administrativeLocationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmLocation"
    ADD CONSTRAINT "FarmLocation_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES public."Location"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FarmLocation FarmLocation_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmLocation"
    ADD CONSTRAINT "FarmLocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FarmLocation FarmLocation_verifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FarmLocation"
    ADD CONSTRAINT "FarmLocation_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_cropId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES public."Crop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_farmLocationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_farmLocationId_fkey" FOREIGN KEY ("farmLocationId") REFERENCES public."FarmLocation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_operatingCenterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_operatingCenterId_fkey" FOREIGN KEY ("operatingCenterId") REFERENCES public."OperatingCenter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_sourceRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HistoricalServiceRecord"
    ADD CONSTRAINT "HistoricalServiceRecord_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES public."SourceRecord"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ImportBatch ImportBatch_approvedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ImportBatch ImportBatch_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ImportBatch ImportBatch_supersedesBatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImportBatch"
    ADD CONSTRAINT "ImportBatch_supersedesBatchId_fkey" FOREIGN KEY ("supersedesBatchId") REFERENCES public."ImportBatch"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LMVHistory LMVHistory_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LMVHistory"
    ADD CONSTRAINT "LMVHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LMVHistory LMVHistory_lmvId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LMVHistory"
    ADD CONSTRAINT "LMVHistory_lmvId_fkey" FOREIGN KEY ("lmvId") REFERENCES public."LMV"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LMV LMV_homeCenterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LMV"
    ADD CONSTRAINT "LMV_homeCenterId_fkey" FOREIGN KEY ("homeCenterId") REFERENCES public."OperatingCenter"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadHistory LeadHistory_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadHistory"
    ADD CONSTRAINT "LeadHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadHistory LeadHistory_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadHistory"
    ADD CONSTRAINT "LeadHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeadSprayPurpose LeadSprayPurpose_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadSprayPurpose"
    ADD CONSTRAINT "LeadSprayPurpose_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lead Lead_businessOrganizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_businessOrganizationId_fkey" FOREIGN KEY ("businessOrganizationId") REFERENCES public."BusinessOrganization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_cropId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES public."Crop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_farmLocationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_farmLocationId_fkey" FOREIGN KEY ("farmLocationId") REFERENCES public."FarmLocation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_matchedCenterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_matchedCenterId_fkey" FOREIGN KEY ("matchedCenterId") REFERENCES public."OperatingCenter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NotificationEscalation NotificationEscalation_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationEscalation"
    ADD CONSTRAINT "NotificationEscalation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OperatingCenter OperatingCenter_administrativeLocationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OperatingCenter"
    ADD CONSTRAINT "OperatingCenter_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES public."Location"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OtpDeliveryOutbox OtpDeliveryOutbox_challengeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OtpDeliveryOutbox"
    ADD CONSTRAINT "OtpDeliveryOutbox_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES public."PhoneVerificationChallenge"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PasswordRecoveryChallenge PasswordRecoveryChallenge_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordRecoveryChallenge"
    ADD CONSTRAINT "PasswordRecoveryChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PaymentRecord PaymentRecord_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PaymentRecord PaymentRecord_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PhoneVerificationChallenge PhoneVerificationChallenge_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PhoneVerificationChallenge"
    ADD CONSTRAINT "PhoneVerificationChallenge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PhoneVerificationChallenge PhoneVerificationChallenge_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PhoneVerificationChallenge"
    ADD CONSTRAINT "PhoneVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ScheduleChangeLog ScheduleChangeLog_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduleChangeLog"
    ADD CONSTRAINT "ScheduleChangeLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SourceRecord SourceRecord_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourceRecord"
    ADD CONSTRAINT "SourceRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."ImportBatch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SourceRecord SourceRecord_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourceRecord"
    ADD CONSTRAINT "SourceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_assignedDroneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_assignedDroneId_fkey" FOREIGN KEY ("assignedDroneId") REFERENCES public."Drone"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_homeCenterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_homeCenterId_fkey" FOREIGN KEY ("homeCenterId") REFERENCES public."OperatingCenter"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VerificationDeliveryAttempt VerificationDeliveryAttempt_challengeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VerificationDeliveryAttempt"
    ADD CONSTRAINT "VerificationDeliveryAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES public."PhoneVerificationChallenge"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: VillageVisit VillageVisit_administrativeLocationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES public."Location"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VillageVisit VillageVisit_collectorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VillageVisit VillageVisit_cropId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES public."Crop"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VillageVisit VillageVisit_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VillageVisit VillageVisit_sourceRecordId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VillageVisit"
    ADD CONSTRAINT "VillageVisit_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES public."SourceRecord"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: _ChatParticipants _ChatParticipants_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ChatParticipants"
    ADD CONSTRAINT "_ChatParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES public."ChatSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ChatParticipants _ChatParticipants_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ChatParticipants"
    ADD CONSTRAINT "_ChatParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict uhhH9Wgr7oAXjVFrrWfixDK77hp5p09OhCOKwdxTmyQpIMljhMCGLRcwljj0GGT

