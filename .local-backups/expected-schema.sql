--
-- PostgreSQL database dump
--

\restrict Y3icEAhXVZEHSpb5corI2nhHRI73Fhc6MSWzUa0Mgd9fWOACeqGsLEBkuNcYRDm

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
-- Name: ClusterType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ClusterType" AS ENUM (
    'HUB',
    'SPOKE',
    'MINIHUB'
);


--
-- Name: CrewFormationState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CrewFormationState" AS ENUM (
    'PENDING_COPILOT_SELECTION',
    'READY',
    'LEGACY_INCOMPLETE'
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
-- Name: MasterDataCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MasterDataCategory" AS ENUM (
    'SPRAY_PURPOSE',
    'B2B_SUBCATEGORY',
    'LEAD_SOURCE',
    'REPORTING_ADMIN'
);


--
-- Name: MissionIssueCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MissionIssueCategory" AS ENUM (
    'DRONE_MALFUNCTION',
    'SAFETY_HAZARD',
    'WEATHER_BLOCKER',
    'CUSTOMER_BLOCKER',
    'OTHER'
);


--
-- Name: MobileApp; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MobileApp" AS ENUM (
    'PILOT_FIELD',
    'OPERATIONS'
);


--
-- Name: MobileAssignmentChangeKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MobileAssignmentChangeKind" AS ENUM (
    'CHANGED',
    'REMOVED'
);


--
-- Name: MobileMutationOutcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MobileMutationOutcome" AS ENUM (
    'APPLIED',
    'ALREADY_APPLIED',
    'CONFLICT',
    'REJECTED',
    'RETRY_LATER'
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
-- Name: PilotAvailabilityState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PilotAvailabilityState" AS ENUM (
    'AVAILABLE',
    'OFFLINE'
);


--
-- Name: RequestType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RequestType" AS ENUM (
    'B2B',
    'B2C'
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


--
-- Name: WeatherUnavailableAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WeatherUnavailableAction" AS ENUM (
    'SCHEDULE_WITH_WARNING',
    'MANUAL_REVIEW'
);


--
-- Name: rfly_capture_customer_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_capture_customer_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_names jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('CustomerHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "CustomerHistory" WHERE "customerId" = NEW."id";

  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN
    actor_id := NULL;
  END IF;

  after_snapshot := jsonb_build_object(
    'active', NEW."active",
    'preferredLanguage', NEW."preferredLanguage",
    'ownership', NEW."ownership",
    'totalAcres', NEW."totalAcres",
    'seasonalProfile', jsonb_build_object(
      'kharifCrop', NEW."kharifCrop", 'kharifAcres', NEW."kharifAcres", 'kharifTanks', NEW."kharifTanks", 'kharifSprayings', NEW."kharifSprayings",
      'rabiCrop', NEW."rabiCrop", 'rabiAcres', NEW."rabiAcres", 'rabiTanks', NEW."rabiTanks", 'rabiSprayings', NEW."rabiSprayings",
      'summerCrop', NEW."summerCrop", 'summerAcres', NEW."summerAcres", 'summerTanks', NEW."summerTanks", 'summerSprayings', NEW."summerSprayings"
    ),
    'hasSubscription', NEW."subscriptionCardNumber" IS NOT NULL OR NEW."subscriptionYear" IS NOT NULL,
    'hasFarmerPortalUser', NEW."farmerUserId" IS NOT NULL,
    'staffConfirmedAt', NEW."staffConfirmedAt"
  );

  IF TG_OP = 'INSERT' THEN
    before_snapshot := NULL;
    changed_names := to_jsonb(ARRAY[
      'displayName', 'phone', 'preferredLanguage', 'ownership', 'totalAcres',
      'location', 'seasonalProfile', 'subscription', 'remarks', 'active',
      'farmerUserId', 'staffConfirmedAt'
    ]::text[]);
  ELSE
    before_snapshot := jsonb_build_object(
      'active', OLD."active",
      'preferredLanguage', OLD."preferredLanguage",
      'ownership', OLD."ownership",
      'totalAcres', OLD."totalAcres",
      'seasonalProfile', jsonb_build_object(
        'kharifCrop', OLD."kharifCrop", 'kharifAcres', OLD."kharifAcres", 'kharifTanks', OLD."kharifTanks", 'kharifSprayings', OLD."kharifSprayings",
        'rabiCrop', OLD."rabiCrop", 'rabiAcres', OLD."rabiAcres", 'rabiTanks', OLD."rabiTanks", 'rabiSprayings', OLD."rabiSprayings",
        'summerCrop', OLD."summerCrop", 'summerAcres', OLD."summerAcres", 'summerTanks', OLD."summerTanks", 'summerSprayings', OLD."summerSprayings"
      ),
      'hasSubscription', OLD."subscriptionCardNumber" IS NOT NULL OR OLD."subscriptionYear" IS NOT NULL,
      'hasFarmerPortalUser', OLD."farmerUserId" IS NOT NULL,
      'staffConfirmedAt', OLD."staffConfirmedAt"
    );
    changed_names := to_jsonb(array_remove(ARRAY[
      CASE WHEN NEW."displayName" IS DISTINCT FROM OLD."displayName" THEN 'displayName' END,
      CASE WHEN NEW."phone" IS DISTINCT FROM OLD."phone" THEN 'phone' END,
      CASE WHEN NEW."preferredLanguage" IS DISTINCT FROM OLD."preferredLanguage" THEN 'preferredLanguage' END,
      CASE WHEN NEW."ownership" IS DISTINCT FROM OLD."ownership" THEN 'ownership' END,
      CASE WHEN NEW."totalAcres" IS DISTINCT FROM OLD."totalAcres" THEN 'totalAcres' END,
      CASE WHEN ROW(NEW."village", NEW."mandal", NEW."district", NEW."state") IS DISTINCT FROM ROW(OLD."village", OLD."mandal", OLD."district", OLD."state") THEN 'location' END,
      CASE WHEN ROW(NEW."kharifCrop", NEW."kharifOtherCrop", NEW."kharifAcres", NEW."kharifTanks", NEW."kharifSprayings", NEW."rabiCrop", NEW."rabiOtherCrop", NEW."rabiAcres", NEW."rabiTanks", NEW."rabiSprayings", NEW."summerCrop", NEW."summerOtherCrop", NEW."summerAcres", NEW."summerTanks", NEW."summerSprayings") IS DISTINCT FROM ROW(OLD."kharifCrop", OLD."kharifOtherCrop", OLD."kharifAcres", OLD."kharifTanks", OLD."kharifSprayings", OLD."rabiCrop", OLD."rabiOtherCrop", OLD."rabiAcres", OLD."rabiTanks", OLD."rabiSprayings", OLD."summerCrop", OLD."summerOtherCrop", OLD."summerAcres", OLD."summerTanks", OLD."summerSprayings") THEN 'seasonalProfile' END,
      CASE WHEN ROW(NEW."subscriptionCardNumber", NEW."subscriptionYear") IS DISTINCT FROM ROW(OLD."subscriptionCardNumber", OLD."subscriptionYear") THEN 'subscription' END,
      CASE WHEN NEW."remarks" IS DISTINCT FROM OLD."remarks" THEN 'remarks' END,
      CASE WHEN NEW."active" IS DISTINCT FROM OLD."active" THEN 'active' END,
      CASE WHEN NEW."farmerUserId" IS DISTINCT FROM OLD."farmerUserId" THEN 'farmerUserId' END,
      CASE WHEN NEW."staffConfirmedAt" IS DISTINCT FROM OLD."staffConfirmedAt" THEN 'staffConfirmedAt' END
    ]::text[], NULL));
  END IF;

  IF TG_OP = 'UPDATE' AND jsonb_array_length(changed_names) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO "CustomerHistory" ("id", "customerId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."active" IS DISTINCT FROM OLD."active" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('fields', changed_names, 'before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


--
-- Name: rfly_capture_drone_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_capture_drone_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('DroneHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "DroneHistory" WHERE "droneId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;
  after_snapshot := jsonb_build_object(
    'name', NEW."name", 'model', NEW."model", 'manufacturer', NEW."manufacturer",
    'serialNumber', NEW."serialNumber", 'uin', NEW."uin", 'type', NEW."type", 'category', NEW."category",
    'tankCapacity', NEW."tankCapacity", 'batteryCapacity', NEW."batteryCapacity", 'endurance', NEW."endurance",
    'tankCapacityLitres', NEW."tankCapacityLitres", 'batteryCapacityMah', NEW."batteryCapacityMah", 'enduranceMinutes', NEW."enduranceMinutes",
    'certified', NEW."certified", 'serviceType', NEW."serviceType", 'status', NEW."status",
    'operationalState', NEW."operationalState", 'availabilityState', NEW."availabilityState",
    'homeCenterId', NEW."homeCenterId", 'airworthinessExpiry', NEW."airworthinessExpiry", 'lastMaintained', NEW."lastMaintained",
    'archivedAt', NEW."archivedAt"
  );
  before_snapshot := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
    'name', OLD."name", 'model', OLD."model", 'manufacturer', OLD."manufacturer",
    'serialNumber', OLD."serialNumber", 'uin', OLD."uin", 'type', OLD."type", 'category', OLD."category",
    'tankCapacity', OLD."tankCapacity", 'batteryCapacity', OLD."batteryCapacity", 'endurance', OLD."endurance",
    'tankCapacityLitres', OLD."tankCapacityLitres", 'batteryCapacityMah', OLD."batteryCapacityMah", 'enduranceMinutes', OLD."enduranceMinutes",
    'certified', OLD."certified", 'serviceType', OLD."serviceType", 'status', OLD."status",
    'operationalState', OLD."operationalState", 'availabilityState', OLD."availabilityState",
    'homeCenterId', OLD."homeCenterId", 'airworthinessExpiry', OLD."airworthinessExpiry", 'lastMaintained', OLD."lastMaintained",
    'archivedAt', OLD."archivedAt"
  ) END;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      NEW."name", NEW."model", NEW."manufacturer", NEW."serialNumber", NEW."uin", NEW."type", NEW."category",
      NEW."tankCapacity", NEW."tankCapacityLitres", NEW."batteryCapacity", NEW."batteryCapacityMah",
      NEW."endurance", NEW."enduranceMinutes", NEW."certified", NEW."serviceType", NEW."status",
      NEW."operationalState", NEW."availabilityState", NEW."homeCenterId", NEW."airworthinessExpiry",
      NEW."lastMaintained", NEW."archivedAt"
    ) IS NOT DISTINCT FROM ROW(
      OLD."name", OLD."model", OLD."manufacturer", OLD."serialNumber", OLD."uin", OLD."type", OLD."category",
      OLD."tankCapacity", OLD."tankCapacityLitres", OLD."batteryCapacity", OLD."batteryCapacityMah",
      OLD."endurance", OLD."enduranceMinutes", OLD."certified", OLD."serviceType", OLD."status",
      OLD."operationalState", OLD."availabilityState", OLD."homeCenterId", OLD."airworthinessExpiry",
      OLD."lastMaintained", OLD."archivedAt"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO "DroneHistory" ("id", "droneId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."archivedAt" IS NOT NULL AND OLD."archivedAt" IS NULL THEN 'ARCHIVED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status"
        OR NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
        OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


--
-- Name: rfly_capture_lead_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_capture_lead_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_names jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('LeadHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "LeadHistory" WHERE "leadId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;

  after_snapshot := jsonb_build_object(
    'status', NEW."status", 'intakeChannel', NEW."intakeChannel",
    'acreage', COALESCE(NEW."acreageDecimal", round(NEW."acreage"::numeric, 2)),
    'cropId', NEW."cropId", 'cropType', NEW."cropType",
    'matchedCenterId', NEW."matchedCenterId", 'farmLocationId', NEW."farmLocationId",
    'soilType', NEW."soilType", 'cropAgeWeeks', NEW."cropAgeWeeks",
    'sprayPurpose', NEW."sprayPurpose", 'hasChemical', NEW."hasChemical",
    'expectedDate', NEW."expectedDate", 'expectedTime', NEW."expectedTime",
    'waterBodyNearby', NEW."waterBodyNearby", 'terrainType', NEW."terrainType",
    'processedAt', NEW."processedAt"
  );
  IF TG_OP = 'INSERT' THEN
    before_snapshot := NULL;
    changed_names := to_jsonb(ARRAY['status', 'intakeChannel', 'acreage', 'crop', 'farmLocation', 'serviceProfile']::text[]);
  ELSE
    before_snapshot := jsonb_build_object(
      'status', OLD."status", 'intakeChannel', OLD."intakeChannel",
      'acreage', COALESCE(OLD."acreageDecimal", round(OLD."acreage"::numeric, 2)),
      'cropId', OLD."cropId", 'cropType', OLD."cropType",
      'matchedCenterId', OLD."matchedCenterId", 'farmLocationId', OLD."farmLocationId",
      'soilType', OLD."soilType", 'cropAgeWeeks', OLD."cropAgeWeeks",
      'sprayPurpose', OLD."sprayPurpose", 'hasChemical', OLD."hasChemical",
      'expectedDate', OLD."expectedDate", 'expectedTime', OLD."expectedTime",
      'waterBodyNearby', OLD."waterBodyNearby", 'terrainType', OLD."terrainType",
      'processedAt', OLD."processedAt"
    );
    changed_names := to_jsonb(array_remove(ARRAY[
      CASE WHEN NEW."status" IS DISTINCT FROM OLD."status" THEN 'status' END,
      CASE WHEN NEW."intakeChannel" IS DISTINCT FROM OLD."intakeChannel" THEN 'intakeChannel' END,
      CASE WHEN NEW."acreage" IS DISTINCT FROM OLD."acreage" OR NEW."acreageDecimal" IS DISTINCT FROM OLD."acreageDecimal" THEN 'acreage' END,
      CASE WHEN NEW."cropType" IS DISTINCT FROM OLD."cropType" OR NEW."cropId" IS DISTINCT FROM OLD."cropId" THEN 'crop' END,
      CASE WHEN NEW."matchedCenterId" IS DISTINCT FROM OLD."matchedCenterId" THEN 'matchedCenterId' END,
      CASE WHEN NEW."farmLocationId" IS DISTINCT FROM OLD."farmLocationId" OR ROW(NEW."latitude", NEW."longitude", NEW."farmerAddress") IS DISTINCT FROM ROW(OLD."latitude", OLD."longitude", OLD."farmerAddress") THEN 'farmLocation' END,
      CASE WHEN ROW(NEW."soilType", NEW."cropAgeWeeks", NEW."chemicalBrand", NEW."sprayPurpose", NEW."hasChemical", NEW."chemicalProofUrl", NEW."expectedDate", NEW."expectedTime", NEW."waterBodyNearby", NEW."terrainType") IS DISTINCT FROM ROW(OLD."soilType", OLD."cropAgeWeeks", OLD."chemicalBrand", OLD."sprayPurpose", OLD."hasChemical", OLD."chemicalProofUrl", OLD."expectedDate", OLD."expectedTime", OLD."waterBodyNearby", OLD."terrainType") THEN 'serviceProfile' END,
      CASE WHEN NEW."notes" IS DISTINCT FROM OLD."notes" THEN 'notes' END,
      CASE WHEN NEW."farmerName" IS DISTINCT FROM OLD."farmerName" THEN 'farmerName' END,
      CASE WHEN NEW."farmerPhone" IS DISTINCT FROM OLD."farmerPhone" THEN 'farmerPhone' END,
      CASE WHEN NEW."processedAt" IS DISTINCT FROM OLD."processedAt" THEN 'processedAt' END
    ]::text[], NULL));
  END IF;

  IF TG_OP = 'UPDATE' AND jsonb_array_length(changed_names) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO "LeadHistory" ("id", "leadId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('fields', changed_names, 'before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


--
-- Name: rfly_capture_lmv_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_capture_lmv_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('LMVHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "LMVHistory" WHERE "lmvId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;
  after_snapshot := jsonb_build_object(
    'registrationNo', NEW."registrationNo", 'label', NEW."label", 'status', NEW."status",
    'operationalState', NEW."operationalState", 'availabilityState', NEW."availabilityState",
    'homeCenterId', NEW."homeCenterId", 'capacity', NEW."capacity", 'notes', NEW."notes"
  );
  before_snapshot := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
    'registrationNo', OLD."registrationNo", 'label', OLD."label", 'status', OLD."status",
    'operationalState', OLD."operationalState", 'availabilityState', OLD."availabilityState",
    'homeCenterId', OLD."homeCenterId", 'capacity', OLD."capacity", 'notes', OLD."notes"
  ) END;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      NEW."registrationNo", NEW."label", NEW."status", NEW."operationalState",
      NEW."availabilityState", NEW."homeCenterId", NEW."capacity", NEW."notes"
    ) IS NOT DISTINCT FROM ROW(
      OLD."registrationNo", OLD."label", OLD."status", OLD."operationalState",
      OLD."availabilityState", OLD."homeCenterId", OLD."capacity", OLD."notes"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO "LMVHistory" ("id", "lmvId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status"
        OR NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
        OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;


--
-- Name: rfly_cleanup_history_for_test(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_cleanup_history_for_test() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF current_database() !~ '_test$'
     OR current_setting('rfly.allow_history_mutation', true) <> 'on' THEN
    RETURN OLD;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'Customer' THEN DELETE FROM "CustomerHistory" WHERE "customerId" = OLD."id";
    WHEN 'Lead' THEN DELETE FROM "LeadHistory" WHERE "leadId" = OLD."id";
    WHEN 'Drone' THEN DELETE FROM "DroneHistory" WHERE "droneId" = OLD."id";
    WHEN 'LMV' THEN DELETE FROM "LMVHistory" WHERE "lmvId" = OLD."id";
  END CASE;
  RETURN OLD;
END;
$_$;


--
-- Name: rfly_guard_assignment_unit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_guard_assignment_unit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  resource_key TEXT;
  conflict_id TEXT;
  drone_is_archived BOOLEAN;
  drone_operational "AssetOperationalState";
  drone_availability "AssetAvailabilityState";
  lmv_operational "AssetOperationalState";
  lmv_availability "AssetAvailabilityState";
BEGIN
  IF NEW."crewFormationState" = 'PENDING_COPILOT_SELECTION'::"CrewFormationState" THEN
    IF NEW."copilotId" IS NOT NULL OR NEW."lmvId" IS NULL OR NEW."legacyCrewIncomplete"
       OR NEW."acceptedAt" IS NOT NULL OR NEW."startedAt" IS NOT NULL
       OR NEW."completedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'A pending Copilot assignment must be a non-executable Primary Pilot, drone, and LMV reservation';
    END IF;
  ELSIF NEW."crewFormationState" = 'LEGACY_INCOMPLETE'::"CrewFormationState" THEN
    IF NOT NEW."legacyCrewIncomplete" THEN
      RAISE EXCEPTION 'Only quarantined legacy assignments may use LEGACY_INCOMPLETE crew state';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD."legacyCrewIncomplete"
         AND NEW."legacyCrewIncomplete"
         AND NEW."pilotId" IS NOT DISTINCT FROM OLD."pilotId"
         AND NEW."copilotId" IS NOT DISTINCT FROM OLD."copilotId"
         AND NEW."droneId" IS NOT DISTINCT FROM OLD."droneId"
         AND NEW."copilotDroneId" IS NOT DISTINCT FROM OLD."copilotDroneId"
         AND NEW."lmvId" IS NOT DISTINCT FROM OLD."lmvId"
         AND (
           (NEW."startedAt" IS NOT DISTINCT FROM OLD."startedAt" AND NEW."completedAt" IS NOT DISTINCT FROM OLD."completedAt")
           OR (OLD."startedAt" IS NOT NULL AND OLD."completedAt" IS NULL AND NEW."completedAt" IS NOT NULL)
         ) THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'A quarantined legacy assignment cannot start or change resources';
  ELSE
    IF NEW."copilotId" IS NULL OR NEW."lmvId" IS NULL OR NEW."legacyCrewIncomplete" THEN
      RAISE EXCEPTION 'A ready assignment requires a complete two-pilot, one-drone, one-LMV crew';
    END IF;
    IF NEW."pilotId" = NEW."copilotId" THEN
      RAISE EXCEPTION 'Pilot and Copilot must be different users';
    END IF;
  END IF;

  IF NEW."copilotDroneId" IS NOT NULL AND NEW."copilotDroneId" <> NEW."droneId" THEN
    RAISE EXCEPTION 'A crew assignment can use only one drone';
  END IF;

  FOR resource_key IN
    SELECT value
    FROM unnest(ARRAY['drone:' || NEW."droneId", 'lmv:' || NEW."lmvId"]) value
    ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('AssignmentResource:' || resource_key));
  END LOOP;

  SELECT "archivedAt" IS NOT NULL, "operationalState", "availabilityState"
  INTO drone_is_archived, drone_operational, drone_availability
  FROM "Drone"
  WHERE "id" = NEW."droneId";
  IF NOT FOUND OR drone_is_archived OR drone_operational <> 'IN_SERVICE'::"AssetOperationalState"
     OR drone_availability = 'UNAVAILABLE'::"AssetAvailabilityState" THEN
    RAISE EXCEPTION 'The assigned drone must be an active in-service asset';
  END IF;

  SELECT "operationalState", "availabilityState"
  INTO lmv_operational, lmv_availability
  FROM "LMV"
  WHERE "id" = NEW."lmvId";
  IF NOT FOUND OR lmv_operational <> 'IN_SERVICE'::"AssetOperationalState"
     OR lmv_availability = 'UNAVAILABLE'::"AssetAvailabilityState" THEN
    RAISE EXCEPTION 'The assigned LMV must be an active in-service asset';
  END IF;

  IF NEW."startedAt" IS NOT NULL AND NEW."completedAt" IS NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD."startedAt" IS NULL
       OR OLD."completedAt" IS NOT NULL
       OR NEW."pilotId" IS DISTINCT FROM OLD."pilotId"
       OR NEW."copilotId" IS DISTINCT FROM OLD."copilotId"
       OR NEW."droneId" IS DISTINCT FROM OLD."droneId"
       OR NEW."lmvId" IS DISTINCT FROM OLD."lmvId"
     ) THEN
    FOR resource_key IN
      SELECT value
      FROM unnest(ARRAY[
        'user:' || NEW."pilotId",
        'user:' || NEW."copilotId",
        'drone:' || NEW."droneId",
        'lmv:' || NEW."lmvId"
      ]) value
      ORDER BY value
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext('AssignmentResource:' || resource_key));
    END LOOP;

    SELECT assignment."id"
    INTO conflict_id
    FROM "Assignment" assignment
    WHERE assignment."id" <> NEW."id"
      AND assignment."startedAt" IS NOT NULL
      AND assignment."completedAt" IS NULL
      AND (
        assignment."pilotId" IN (NEW."pilotId", NEW."copilotId")
        OR assignment."copilotId" IN (NEW."pilotId", NEW."copilotId")
        OR assignment."droneId" = NEW."droneId"
        OR assignment."lmvId" = NEW."lmvId"
      )
    LIMIT 1;

    IF conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Another active assignment already uses this crew, drone, or LMV';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: rfly_guard_import_outcome(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_guard_import_outcome() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  source_system "ImportSourceType";
BEGIN
  SELECT "sourceSystem" INTO source_system
  FROM "SourceRecord"
  WHERE "id" = NEW."sourceRecordId";

  IF source_system IS NULL THEN
    RAISE EXCEPTION 'The import outcome requires an existing SourceRecord';
  END IF;

  IF TG_TABLE_NAME = 'HistoricalServiceRecord' THEN
    IF source_system <> 'ZOHO_CRM'::"ImportSourceType" THEN
      RAISE EXCEPTION 'HistoricalServiceRecord requires a ZOHO_CRM source row';
    END IF;
    IF EXISTS (SELECT 1 FROM "VillageVisit" WHERE "sourceRecordId" = NEW."sourceRecordId") THEN
      RAISE EXCEPTION 'The SourceRecord already has a VillageVisit outcome';
    END IF;
  ELSIF TG_TABLE_NAME = 'VillageVisit' THEN
    IF source_system <> 'GOOGLE_FORMS'::"ImportSourceType" THEN
      RAISE EXCEPTION 'VillageVisit requires a GOOGLE_FORMS source row';
    END IF;
    IF EXISTS (SELECT 1 FROM "HistoricalServiceRecord" WHERE "sourceRecordId" = NEW."sourceRecordId") THEN
      RAISE EXCEPTION 'The SourceRecord already has a HistoricalServiceRecord outcome';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: rfly_guard_source_record_terminal_evidence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_guard_source_record_terminal_evidence() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF current_database() ~ '_test$'
     AND current_setting('rfly.allow_history_mutation', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('IMPORTED', 'SKIPPED') THEN
      RAISE EXCEPTION 'Terminal SourceRecord evidence cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" IN ('IMPORTED', 'SKIPPED')
     AND ROW(
       NEW."sourceSystem", NEW."sheetName", NEW."sourceRowNumber", NEW."externalRecordId",
       NEW."rowFingerprint", NEW."status", NEW."customerId", NEW."resultEntityType",
       NEW."resultEntityId", NEW."committedAt"
     ) IS DISTINCT FROM ROW(
       OLD."sourceSystem", OLD."sheetName", OLD."sourceRowNumber", OLD."externalRecordId",
       OLD."rowFingerprint", OLD."status", OLD."customerId", OLD."resultEntityType",
       OLD."resultEntityId", OLD."committedAt"
     ) THEN
    RAISE EXCEPTION 'Terminal SourceRecord identity and outcome evidence are immutable';
  END IF;

  IF NEW."status" = 'IMPORTED' THEN
    IF NEW."customerId" IS NULL OR NEW."resultEntityType" IS NULL
       OR NEW."resultEntityId" IS NULL OR NEW."committedAt" IS NULL THEN
      RAISE EXCEPTION 'An imported SourceRecord requires complete reconciliation evidence';
    END IF;
    IF NEW."sourceSystem" = 'ZOHO_CRM'::"ImportSourceType" THEN
      IF NEW."resultEntityType" <> 'HistoricalServiceRecord'
         OR NOT EXISTS (
           SELECT 1 FROM "HistoricalServiceRecord"
           WHERE "id" = NEW."resultEntityId" AND "sourceRecordId" = NEW."id"
         ) THEN
        RAISE EXCEPTION 'ZOHO_CRM SourceRecord outcome evidence is inconsistent';
      END IF;
    ELSIF NEW."sourceSystem" = 'GOOGLE_FORMS'::"ImportSourceType" THEN
      IF NEW."resultEntityType" <> 'VillageVisit'
         OR NOT EXISTS (
           SELECT 1 FROM "VillageVisit"
           WHERE "id" = NEW."resultEntityId" AND "sourceRecordId" = NEW."id"
         ) THEN
        RAISE EXCEPTION 'GOOGLE_FORMS SourceRecord outcome evidence is inconsistent';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$_$;


--
-- Name: rfly_prevent_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_prevent_history_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  IF current_database() ~ '_test$'
     AND current_setting('rfly.allow_history_mutation', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION '% is append-only; history rows cannot be updated or deleted', TG_TABLE_NAME;
END;
$_$;


--
-- Name: rfly_record_assignment_mobile_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_record_assignment_mobile_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_kind "MobileAssignmentChangeKind";
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
    SELECT participant, OLD."id", 'REMOVED', OLD."revision"
    FROM unnest(ARRAY[OLD."pilotId", OLD."copilotId"]) AS participant
    WHERE participant IS NOT NULL;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
    SELECT participant, OLD."id", 'REMOVED', OLD."revision"
    FROM unnest(ARRAY[OLD."pilotId", OLD."copilotId"]) AS participant
    WHERE participant IS NOT NULL
      AND NOT (participant = ANY(array_remove(ARRAY[NEW."pilotId", NEW."copilotId"]::text[], NULL)));
  END IF;

  SELECT CASE WHEN l."status"::text IN ('CANCELLED', 'REJECTED')
    THEN 'REMOVED'::"MobileAssignmentChangeKind"
    ELSE 'CHANGED'::"MobileAssignmentChangeKind"
  END INTO current_kind
  FROM "Lead" l WHERE l."id" = NEW."leadId";

  INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision", "changedAt")
  SELECT participant, NEW."id", current_kind, NEW."revision", NEW."updatedAt"
  FROM unnest(ARRAY[NEW."pilotId", NEW."copilotId"]) AS participant
  WHERE participant IS NOT NULL;
  RETURN NEW;
END;
$$;


--
-- Name: rfly_record_lead_mobile_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_record_lead_mobile_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  assignment_row "Assignment"%ROWTYPE;
  change_kind "MobileAssignmentChangeKind";
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN RETURN NEW; END IF;
  SELECT * INTO assignment_row FROM "Assignment" WHERE "leadId" = NEW."id";
  IF NOT FOUND THEN RETURN NEW; END IF;
  change_kind := CASE WHEN NEW."status"::text IN ('CANCELLED', 'REJECTED')
    THEN 'REMOVED'::"MobileAssignmentChangeKind"
    ELSE 'CHANGED'::"MobileAssignmentChangeKind" END;
  INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
  SELECT participant, assignment_row."id", change_kind, assignment_row."revision"
  FROM unnest(ARRAY[assignment_row."pilotId", assignment_row."copilotId"]) AS participant
  WHERE participant IS NOT NULL;
  RETURN NEW;
END;
$$;


--
-- Name: rfly_sync_asset_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rfly_sync_asset_state() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- On INSERT, a non-default legacy status remains authoritative for old
  -- clients. Otherwise an explicitly non-default normalized pair wins. On
  -- UPDATE, whichever representation changed is mirrored to the other.
  IF TG_OP = 'INSERT'
     AND NEW."status"::text = 'AVAILABLE'
     AND (
       NEW."operationalState" <> 'IN_SERVICE'::"AssetOperationalState"
       OR NEW."availabilityState" <> 'AVAILABLE'::"AssetAvailabilityState"
     ) THEN
    IF NEW."operationalState" = 'MAINTENANCE' THEN
      NEW."status" := 'MAINTENANCE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."operationalState" = 'OUT_OF_SERVICE' THEN
      NEW."status" := 'OUT_OF_SERVICE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."availabilityState" = 'ASSIGNED' THEN
      NEW."status" := 'ASSIGNED';
    ELSE
      NEW."status" := 'AVAILABLE';
      NEW."availabilityState" := 'AVAILABLE';
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    CASE NEW."status"::text
      WHEN 'AVAILABLE' THEN
        NEW."operationalState" := 'IN_SERVICE';
        NEW."availabilityState" := 'AVAILABLE';
      WHEN 'ASSIGNED' THEN
        NEW."operationalState" := 'IN_SERVICE';
        NEW."availabilityState" := 'ASSIGNED';
      WHEN 'MAINTENANCE' THEN
        NEW."operationalState" := 'MAINTENANCE';
        NEW."availabilityState" := 'UNAVAILABLE';
      WHEN 'OUT_OF_SERVICE' THEN
        NEW."operationalState" := 'OUT_OF_SERVICE';
        NEW."availabilityState" := 'UNAVAILABLE';
    END CASE;
  ELSIF NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
     OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN
    IF NEW."operationalState" = 'MAINTENANCE' THEN
      NEW."status" := 'MAINTENANCE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."operationalState" = 'OUT_OF_SERVICE' THEN
      NEW."status" := 'OUT_OF_SERVICE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."availabilityState" = 'ASSIGNED' THEN
      NEW."status" := 'ASSIGNED';
    ELSIF NEW."availabilityState" = 'AVAILABLE' THEN
      NEW."status" := 'AVAILABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


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
    "copilotId" text,
    "dailySequence" integer DEFAULT 1 NOT NULL,
    "copilotDroneId" text,
    "serviceWindowEnd" timestamp(3) without time zone,
    "serviceWindowStart" timestamp(3) without time zone,
    "legacyCrewIncomplete" boolean DEFAULT false NOT NULL,
    "crewFormationState" public."CrewFormationState" DEFAULT 'READY'::public."CrewFormationState" NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    "copilotSelectedAt" timestamp(3) without time zone,
    "crewFormationUpdatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "issueCategory" public."MissionIssueCategory",
    "issueNote" text,
    "issueReportedAt" timestamp(3) without time zone,
    CONSTRAINT "Assignment_crew_formation_check" CHECK (((("crewFormationState" = 'READY'::public."CrewFormationState") AND ("copilotId" IS NOT NULL) AND ("lmvId" IS NOT NULL) AND (NOT "legacyCrewIncomplete")) OR (("crewFormationState" = 'PENDING_COPILOT_SELECTION'::public."CrewFormationState") AND ("copilotId" IS NULL) AND ("lmvId" IS NOT NULL) AND (NOT "legacyCrewIncomplete") AND ("acceptedAt" IS NULL) AND ("startedAt" IS NULL) AND ("completedAt" IS NULL)) OR (("crewFormationState" = 'LEGACY_INCOMPLETE'::public."CrewFormationState") AND "legacyCrewIncomplete"))),
    CONSTRAINT "Assignment_daily_sequence_positive_check" CHECK (("dailySequence" > 0)),
    CONSTRAINT "Assignment_distinct_crew_check" CHECK ((("copilotId" IS NULL) OR ("pilotId" <> "copilotId"))),
    CONSTRAINT "Assignment_issue_consistency_check" CHECK (((("issueCategory" IS NULL) AND ("issueNote" IS NULL) AND ("issueReportedAt" IS NULL)) OR (("issueCategory" IS NOT NULL) AND (NULLIF(btrim("issueNote"), ''::text) IS NOT NULL) AND ("issueReportedAt" IS NOT NULL)))),
    CONSTRAINT "Assignment_issue_note_length_check" CHECK ((("issueNote" IS NULL) OR ((char_length("issueNote") >= 1) AND (char_length("issueNote") <= 500)))),
    CONSTRAINT "Assignment_revision_check" CHECK ((revision > 0)),
    CONSTRAINT "Assignment_service_window_order_check" CHECK ((("serviceWindowStart" IS NULL) OR ("serviceWindowEnd" IS NULL) OR ("serviceWindowEnd" > "serviceWindowStart"))),
    CONSTRAINT "Assignment_single_drone_check" CHECK ((("copilotDroneId" IS NULL) OR ("copilotDroneId" = "droneId")))
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
-- Name: AutoAssignmentPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AutoAssignmentPolicy" (
    id text NOT NULL,
    "singletonKey" text DEFAULT 'COMPANY'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "searchHorizonDays" integer DEFAULT 5 NOT NULL,
    "workingDayStartMinutes" integer DEFAULT 540 NOT NULL,
    "workingDayEndMinutes" integer DEFAULT 1080 NOT NULL,
    "defaultJobDurationMinutes" integer DEFAULT 120 NOT NULL,
    "turnaroundMinutes" integer DEFAULT 30 NOT NULL,
    "maxJobsPerUnitPerDay" integer,
    "maxAcreagePerUnitPerDay" numeric(12,2),
    "weatherUnavailableAction" public."WeatherUnavailableAction" DEFAULT 'SCHEDULE_WITH_WARNING'::public."WeatherUnavailableAction" NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "AutoAssignmentPolicy_acreage_cap_check" CHECK ((("maxAcreagePerUnitPerDay" IS NULL) OR ("maxAcreagePerUnitPerDay" > (0)::numeric))),
    CONSTRAINT "AutoAssignmentPolicy_duration_check" CHECK ((("defaultJobDurationMinutes" >= 15) AND ("defaultJobDurationMinutes" <= 720))),
    CONSTRAINT "AutoAssignmentPolicy_jobs_cap_check" CHECK ((("maxJobsPerUnitPerDay" IS NULL) OR (("maxJobsPerUnitPerDay" >= 1) AND ("maxJobsPerUnitPerDay" <= 20)))),
    CONSTRAINT "AutoAssignmentPolicy_revision_check" CHECK ((revision > 0)),
    CONSTRAINT "AutoAssignmentPolicy_search_horizon_check" CHECK ((("searchHorizonDays" >= 1) AND ("searchHorizonDays" <= 14))),
    CONSTRAINT "AutoAssignmentPolicy_singleton_key_check" CHECK (("singletonKey" = 'COMPANY'::text)),
    CONSTRAINT "AutoAssignmentPolicy_turnaround_check" CHECK ((("turnaroundMinutes" >= 0) AND ("turnaroundMinutes" <= 240))),
    CONSTRAINT "AutoAssignmentPolicy_working_end_check" CHECK ((("workingDayEndMinutes" >= 1) AND ("workingDayEndMinutes" <= 1440))),
    CONSTRAINT "AutoAssignmentPolicy_working_range_check" CHECK (("workingDayEndMinutes" > "workingDayStartMinutes")),
    CONSTRAINT "AutoAssignmentPolicy_working_start_check" CHECK ((("workingDayStartMinutes" >= 0) AND ("workingDayStartMinutes" <= 1439)))
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
-- Name: Cluster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cluster" (
    id text NOT NULL,
    code character varying(40) NOT NULL,
    "displayName" character varying(120) NOT NULL,
    type public."ClusterType" NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Crop_code_trimmed_check" CHECK (((length(TRIM(BOTH FROM code)) > 0) AND ((code)::text = lower(TRIM(BOTH FROM code))))),
    CONSTRAINT "Crop_normalized_name_check" CHECK (((length(TRIM(BOTH FROM "normalizedName")) > 0) AND (("normalizedName")::text = lower(TRIM(BOTH FROM "normalizedName"))) AND (("normalizedName")::text !~ '[[:space:]]'::text)))
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
    ownership text,
    "totalAcres" double precision,
    mandal text,
    state text,
    "kharifCrop" text,
    "kharifOtherCrop" text,
    "kharifAcres" double precision,
    "kharifTanks" double precision,
    "kharifSprayings" integer,
    "rabiCrop" text,
    "rabiOtherCrop" text,
    "rabiAcres" double precision,
    "rabiTanks" double precision,
    "rabiSprayings" integer,
    "summerCrop" text,
    "summerOtherCrop" text,
    "summerAcres" double precision,
    "summerTanks" double precision,
    "summerSprayings" integer,
    "subscriptionCardNumber" text,
    "subscriptionYear" text,
    remarks text,
    active boolean DEFAULT true NOT NULL,
    "createdByImportBatchId" text,
    "clusterId" text,
    CONSTRAINT "Customer_phone_canonical_check" CHECK ((phone ~ '^[+][0-9]{8,15}$'::text))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "CustomerLanguagePreference_rank_positive_check" CHECK ((rank > 0))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "CustomerSeasonalCrop_acreage_nonnegative_check" CHECK (((acreage IS NULL) OR (acreage >= (0)::numeric))),
    CONSTRAINT "CustomerSeasonalCrop_sprayings_nonnegative_check" CHECK ((("expectedSprayings" IS NULL) OR ("expectedSprayings" >= 0))),
    CONSTRAINT "CustomerSeasonalCrop_tanks_nonnegative_check" CHECK ((("tankQuantity" IS NULL) OR ("tankQuantity" >= (0)::numeric)))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "CustomerSubscription_date_order_check" CHECK ((("validFrom" IS NULL) OR ("validUntil" IS NULL) OR ("validUntil" >= "validFrom")))
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
    status public."DroneStatus" DEFAULT 'AVAILABLE'::public."DroneStatus" NOT NULL,
    "homeCenterId" text NOT NULL,
    "airworthinessExpiry" timestamp(3) without time zone,
    "lastMaintained" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name text,
    manufacturer text,
    certified boolean DEFAULT false NOT NULL,
    "serviceType" text,
    "batteryCapacity" integer,
    endurance integer,
    location text,
    "tankCapacity" double precision,
    type text,
    uin text,
    "serialNumber" text NOT NULL,
    category text,
    "tankCapacityLitres" double precision,
    "batteryCapacityMah" integer,
    "enduranceMinutes" integer,
    "archivedAt" timestamp(3) without time zone,
    "availabilityState" public."AssetAvailabilityState" DEFAULT 'AVAILABLE'::public."AssetAvailabilityState" NOT NULL,
    "operationalState" public."AssetOperationalState" DEFAULT 'IN_SERVICE'::public."AssetOperationalState" NOT NULL,
    CONSTRAINT "Drone_archived_state_check" CHECK ((("archivedAt" IS NULL) OR ((status = 'OUT_OF_SERVICE'::public."DroneStatus") AND ("operationalState" = 'OUT_OF_SERVICE'::public."AssetOperationalState") AND ("availabilityState" = 'UNAVAILABLE'::public."AssetAvailabilityState")))),
    CONSTRAINT "Drone_asset_state_consistency_check" CHECK (((("operationalState" = 'IN_SERVICE'::public."AssetOperationalState") AND ("availabilityState" = ANY (ARRAY['AVAILABLE'::public."AssetAvailabilityState", 'ASSIGNED'::public."AssetAvailabilityState"]))) OR (("operationalState" = ANY (ARRAY['MAINTENANCE'::public."AssetOperationalState", 'OUT_OF_SERVICE'::public."AssetOperationalState"])) AND ("availabilityState" = 'UNAVAILABLE'::public."AssetAvailabilityState")))),
    CONSTRAINT "Drone_capacity_nonnegative_check" CHECK (((("tankCapacity" IS NULL) OR ("tankCapacity" >= (0)::double precision)) AND (("tankCapacityLitres" IS NULL) OR ("tankCapacityLitres" >= (0)::double precision)) AND (("batteryCapacity" IS NULL) OR ("batteryCapacity" >= 0)) AND (("batteryCapacityMah" IS NULL) OR ("batteryCapacityMah" >= 0)) AND ((endurance IS NULL) OR (endurance >= 0)) AND (("enduranceMinutes" IS NULL) OR ("enduranceMinutes" >= 0))))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "FarmLocation_accuracy_nonnegative_check" CHECK ((("accuracyMeters" IS NULL) OR ("accuracyMeters" >= (0)::numeric))),
    CONSTRAINT "FarmLocation_coordinate_pair_check" CHECK (((latitude IS NULL) = (longitude IS NULL))),
    CONSTRAINT "FarmLocation_latitude_range_check" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
    CONSTRAINT "FarmLocation_longitude_range_check" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "HistoricalServiceRecord_acres_nonnegative_check" CHECK ((("servicedAcres" IS NULL) OR ("servicedAcres" >= (0)::numeric)))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "ImportBatch_approval_evidence_check" CHECK (((status <> ALL (ARRAY['APPROVED'::public."ImportBatchStatus", 'IMPORTING'::public."ImportBatchStatus", 'COMPLETED'::public."ImportBatchStatus"])) OR (("approvedByUserId" IS NOT NULL) AND ("approvedAt" IS NOT NULL) AND ("approvalReference" IS NOT NULL) AND ("backupEvidenceReference" IS NOT NULL) AND ("expectedDeploymentName" IS NOT NULL) AND ("dryRunPlanHash" IS NOT NULL) AND ("referenceDataFingerprint" IS NOT NULL)))),
    CONSTRAINT "ImportBatch_attempt_positive_check" CHECK (("attemptNumber" > 0)),
    CONSTRAINT "ImportBatch_completion_evidence_check" CHECK (((status <> 'COMPLETED'::public."ImportBatchStatus") OR (("completedAt" IS NOT NULL) AND ("reconciledAt" IS NOT NULL) AND ("reconciliationChecksum" IS NOT NULL) AND ("failureCode" IS NULL)))),
    CONSTRAINT "ImportBatch_counts_nonnegative_check" CHECK ((("totalRows" >= 0) AND ("validRows" >= 0) AND ("rejectedRows" >= 0) AND ("reviewRows" >= 0) AND ("importedRows" >= 0) AND ("skippedRows" >= 0))),
    CONSTRAINT "ImportBatch_counts_reconcile_check" CHECK ((("totalRows" = ((("validRows" + "rejectedRows") + "reviewRows") + "skippedRows")) AND ("importedRows" <= "validRows"))),
    CONSTRAINT "ImportBatch_file_size_positive_check" CHECK (("fileSizeBytes" > 0)),
    CONSTRAINT "ImportBatch_retention_after_creation_check" CHECK (("rawRetentionUntil" > "createdAt"))
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
    "operationalState" public."AssetOperationalState" DEFAULT 'IN_SERVICE'::public."AssetOperationalState" NOT NULL,
    CONSTRAINT "LMV_asset_state_consistency_check" CHECK (((("operationalState" = 'IN_SERVICE'::public."AssetOperationalState") AND ("availabilityState" = ANY (ARRAY['AVAILABLE'::public."AssetAvailabilityState", 'ASSIGNED'::public."AssetAvailabilityState"]))) OR (("operationalState" = ANY (ARRAY['MAINTENANCE'::public."AssetOperationalState", 'OUT_OF_SERVICE'::public."AssetOperationalState"])) AND ("availabilityState" = 'UNAVAILABLE'::public."AssetAvailabilityState")))),
    CONSTRAINT "LMV_capacity_positive_check" CHECK ((capacity > 0))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Language_code_trimmed_check" CHECK (((length(TRIM(BOTH FROM code)) > 0) AND ((code)::text = lower(TRIM(BOTH FROM code)))))
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
    "soilType" text,
    "cropAgeWeeks" integer,
    "chemicalBrand" text,
    "sprayPurpose" text,
    "hasChemical" boolean DEFAULT true NOT NULL,
    "chemicalProofUrl" text,
    "expectedDate" timestamp(3) without time zone,
    "expectedTime" text,
    "waterBodyNearby" boolean DEFAULT false NOT NULL,
    "terrainType" text,
    "customerId" text,
    "businessOrganizationId" text,
    "acreageDecimal" numeric(12,2),
    "cropId" text,
    "farmLocationId" text,
    "requestType" public."RequestType",
    "b2bSubcategoryCode" text,
    "clusterId" text,
    "reportingAdminCode" text,
    "leadSourceCode" text,
    CONSTRAINT "Lead_acreage_decimal_nonnegative_check" CHECK ((("acreageDecimal" IS NULL) OR ("acreageDecimal" >= (0)::numeric))),
    CONSTRAINT "Lead_request_type_category_check" CHECK ((("requestType" IS NULL) OR (("requestType" = 'B2B'::public."RequestType") AND ("b2bSubcategoryCode" IS NOT NULL)) OR (("requestType" = 'B2C'::public."RequestType") AND ("b2bSubcategoryCode" IS NULL))))
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Location_normalized_key_check" CHECK (((length(TRIM(BOTH FROM "normalizedKey")) > 0) AND (("normalizedKey")::text = lower(TRIM(BOTH FROM "normalizedKey")))))
);


--
-- Name: MasterDataValue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MasterDataValue" (
    id text NOT NULL,
    category public."MasterDataCategory" NOT NULL,
    code character varying(60) NOT NULL,
    "displayName" character varying(160) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MobileAssignmentChange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MobileAssignmentChange" (
    id bigint NOT NULL,
    "userId" text NOT NULL,
    "assignmentId" text NOT NULL,
    kind public."MobileAssignmentChangeKind" NOT NULL,
    revision integer,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MobileAssignmentChange_revision_check" CHECK (((revision IS NULL) OR (revision > 0)))
);


--
-- Name: MobileAssignmentChange_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MobileAssignmentChange_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MobileAssignmentChange_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MobileAssignmentChange_id_seq" OWNED BY public."MobileAssignmentChange".id;


--
-- Name: MobileInstallation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MobileInstallation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    app public."MobileApp" NOT NULL,
    "installationKeyHash" character varying(128) NOT NULL,
    label character varying(80),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokeReason" character varying(200),
    CONSTRAINT "MobileInstallation_key_hash_check" CHECK (((length(("installationKeyHash")::text) >= 32) AND (length(("installationKeyHash")::text) <= 128))),
    CONSTRAINT "MobileInstallation_revoke_reason_check" CHECK ((("revokedAt" IS NULL) OR (NULLIF(btrim(("revokeReason")::text), ''::text) IS NOT NULL)))
);


--
-- Name: MobileMutationReceipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MobileMutationReceipt" (
    id text NOT NULL,
    "installationId" text NOT NULL,
    "assignmentId" text,
    "actionId" character varying(128) NOT NULL,
    operation character varying(64) NOT NULL,
    "requestHash" character varying(128) NOT NULL,
    outcome public."MobileMutationOutcome" NOT NULL,
    "safeResult" jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MobileMutationReceipt_action_check" CHECK ((NULLIF(btrim(("actionId")::text), ''::text) IS NOT NULL)),
    CONSTRAINT "MobileMutationReceipt_operation_check" CHECK ((NULLIF(btrim((operation)::text), ''::text) IS NOT NULL)),
    CONSTRAINT "MobileMutationReceipt_request_hash_check" CHECK (((length(("requestHash")::text) >= 32) AND (length(("requestHash")::text) <= 128)))
);


--
-- Name: MobileSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MobileSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "installationId" text NOT NULL,
    "tokenHash" character varying(128) NOT NULL,
    "authVersion" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "idleExpiresAt" timestamp(3) without time zone NOT NULL,
    "absoluteExpiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokeReason" character varying(200),
    CONSTRAINT "MobileSession_expiry_check" CHECK ((("idleExpiresAt" > "createdAt") AND ("absoluteExpiresAt" > "createdAt"))),
    CONSTRAINT "MobileSession_revoke_reason_check" CHECK ((("revokedAt" IS NULL) OR (NULLIF(btrim(("revokeReason")::text), ''::text) IS NOT NULL))),
    CONSTRAINT "MobileSession_token_hash_check" CHECK (((length(("tokenHash")::text) >= 32) AND (length(("tokenHash")::text) <= 128)))
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
-- Name: PilotAssignmentRejection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PilotAssignmentRejection" (
    id text NOT NULL,
    "formerAssignmentId" text NOT NULL,
    "leadId" text NOT NULL,
    "rejectedByPilotId" text NOT NULL,
    reason character varying(500) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "SourceRecord_encryption_shape_check" CHECK ((((octet_length("encryptedPayload") > 0) AND (octet_length("payloadIv") = 12) AND (octet_length("payloadAuthTag") = 16)) OR ((octet_length("encryptedPayload") = 0) AND (octet_length("payloadIv") = 0) AND (octet_length("payloadAuthTag") = 0)))),
    CONSTRAINT "SourceRecord_external_id_nonblank_check" CHECK ((("externalRecordId" IS NULL) OR (length(TRIM(BOTH FROM "externalRecordId")) > 0))),
    CONSTRAINT "SourceRecord_fingerprint_format_check" CHECK ((("rowFingerprint" ~ '^[0-9a-f]{64}$'::text) AND (("phoneFingerprint" IS NULL) OR ("phoneFingerprint" ~ '^[0-9a-f]{64}$'::text)))),
    CONSTRAINT "SourceRecord_row_number_positive_check" CHECK (("sourceRowNumber" > 1))
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
    village text,
    district text,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    "businessName" text,
    "gstNo" text,
    "contactPerson" text,
    address text,
    "addressLine1" text,
    "addressLine2" text,
    "assignedDroneId" text,
    city text,
    "idProof" text,
    "licenseId" text,
    pincode text,
    state text,
    "employeeCode" text,
    "pilotAvailabilityState" public."PilotAvailabilityState" DEFAULT 'AVAILABLE'::public."PilotAvailabilityState" NOT NULL,
    "assignedLmvId" text,
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "VillageVisit_acres_nonnegative_check" CHECK ((("observedAcres" IS NULL) OR ("observedAcres" >= (0)::numeric)))
);


--
-- Name: _ChatParticipants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_ChatParticipants" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: MobileAssignmentChange id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileAssignmentChange" ALTER COLUMN id SET DEFAULT nextval('public."MobileAssignmentChange_id_seq"'::regclass);


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
-- Name: AutoAssignmentPolicy AutoAssignmentPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoAssignmentPolicy"
    ADD CONSTRAINT "AutoAssignmentPolicy_pkey" PRIMARY KEY (id);


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
-- Name: Cluster Cluster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cluster"
    ADD CONSTRAINT "Cluster_pkey" PRIMARY KEY (id);


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
-- Name: MasterDataValue MasterDataValue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasterDataValue"
    ADD CONSTRAINT "MasterDataValue_pkey" PRIMARY KEY (id);


--
-- Name: MobileAssignmentChange MobileAssignmentChange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileAssignmentChange"
    ADD CONSTRAINT "MobileAssignmentChange_pkey" PRIMARY KEY (id);


--
-- Name: MobileInstallation MobileInstallation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileInstallation"
    ADD CONSTRAINT "MobileInstallation_pkey" PRIMARY KEY (id);


--
-- Name: MobileMutationReceipt MobileMutationReceipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileMutationReceipt"
    ADD CONSTRAINT "MobileMutationReceipt_pkey" PRIMARY KEY (id);


--
-- Name: MobileSession MobileSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileSession"
    ADD CONSTRAINT "MobileSession_pkey" PRIMARY KEY (id);


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
-- Name: PilotAssignmentRejection PilotAssignmentRejection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotAssignmentRejection"
    ADD CONSTRAINT "PilotAssignmentRejection_pkey" PRIMARY KEY (id);


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
-- Name: Assignment_copilotId_serviceWindowStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_copilotId_serviceWindowStart_idx" ON public."Assignment" USING btree ("copilotId", "serviceWindowStart");


--
-- Name: Assignment_crewFormationState_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_crewFormationState_scheduledDate_idx" ON public."Assignment" USING btree ("crewFormationState", "scheduledDate");


--
-- Name: Assignment_crew_day_sequence_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Assignment_crew_day_sequence_key" ON public."Assignment" USING btree (LEAST("pilotId", "copilotId"), GREATEST("pilotId", "copilotId"), "droneId", "lmvId", (("scheduledDate")::date), "dailySequence") WHERE (("copilotId" IS NOT NULL) AND ("lmvId" IS NOT NULL));


--
-- Name: Assignment_droneId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_droneId_scheduledDate_idx" ON public."Assignment" USING btree ("droneId", "scheduledDate");


--
-- Name: Assignment_droneId_serviceWindowStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_droneId_serviceWindowStart_idx" ON public."Assignment" USING btree ("droneId", "serviceWindowStart");


--
-- Name: Assignment_issueCategory_issueReportedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_issueCategory_issueReportedAt_idx" ON public."Assignment" USING btree ("issueCategory", "issueReportedAt");


--
-- Name: Assignment_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Assignment_leadId_key" ON public."Assignment" USING btree ("leadId");


--
-- Name: Assignment_lmvId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_lmvId_scheduledDate_idx" ON public."Assignment" USING btree ("lmvId", "scheduledDate");


--
-- Name: Assignment_lmvId_serviceWindowStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_lmvId_serviceWindowStart_idx" ON public."Assignment" USING btree ("lmvId", "serviceWindowStart");


--
-- Name: Assignment_pilotId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_pilotId_scheduledDate_idx" ON public."Assignment" USING btree ("pilotId", "scheduledDate");


--
-- Name: Assignment_pilotId_serviceWindowStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_pilotId_serviceWindowStart_idx" ON public."Assignment" USING btree ("pilotId", "serviceWindowStart");


--
-- Name: Assignment_scheduledDate_dailySequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_scheduledDate_dailySequence_idx" ON public."Assignment" USING btree ("scheduledDate", "dailySequence");


--
-- Name: Assignment_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_updatedAt_idx" ON public."Assignment" USING btree ("updatedAt");


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
-- Name: AutoAssignmentPolicy_singletonKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AutoAssignmentPolicy_singletonKey_key" ON public."AutoAssignmentPolicy" USING btree ("singletonKey");


--
-- Name: AutoAssignmentPolicy_updatedByUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AutoAssignmentPolicy_updatedByUserId_idx" ON public."AutoAssignmentPolicy" USING btree ("updatedByUserId");


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
-- Name: Cluster_active_sortOrder_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Cluster_active_sortOrder_displayName_idx" ON public."Cluster" USING btree (active, "sortOrder", "displayName");


--
-- Name: Cluster_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Cluster_code_key" ON public."Cluster" USING btree (code);


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
-- Name: CustomerSeasonalCrop_current_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerSeasonalCrop_current_key" ON public."CustomerSeasonalCrop" USING btree ("customerId", season) WHERE ("seasonYear" IS NULL);


--
-- Name: CustomerSeasonalCrop_customerId_season_seasonYear_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerSeasonalCrop_customerId_season_seasonYear_idx" ON public."CustomerSeasonalCrop" USING btree ("customerId", season, "seasonYear");


--
-- Name: CustomerSubscription_cardNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerSubscription_cardNumber_key" ON public."CustomerSubscription" USING btree ("cardNumber");


--
-- Name: CustomerSubscription_current_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CustomerSubscription_current_key" ON public."CustomerSubscription" USING btree ("customerId") WHERE (status = ANY (ARRAY['ACTIVE'::public."SubscriptionStatus", 'UNKNOWN'::public."SubscriptionStatus"]));


--
-- Name: CustomerSubscription_customerId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerSubscription_customerId_status_idx" ON public."CustomerSubscription" USING btree ("customerId", status);


--
-- Name: Customer_active_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_active_updatedAt_idx" ON public."Customer" USING btree (active, "updatedAt");


--
-- Name: Customer_clusterId_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Customer_clusterId_active_idx" ON public."Customer" USING btree ("clusterId", active);


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
-- Name: Lead_clusterId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_clusterId_createdAt_idx" ON public."Lead" USING btree ("clusterId", "createdAt");


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
-- Name: Lead_reportingAdminCode_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_reportingAdminCode_createdAt_idx" ON public."Lead" USING btree ("reportingAdminCode", "createdAt");


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
-- Name: MasterDataValue_category_active_sortOrder_displayName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterDataValue_category_active_sortOrder_displayName_idx" ON public."MasterDataValue" USING btree (category, active, "sortOrder", "displayName");


--
-- Name: MasterDataValue_category_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MasterDataValue_category_code_key" ON public."MasterDataValue" USING btree (category, code);


--
-- Name: MobileAssignmentChange_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileAssignmentChange_changedAt_idx" ON public."MobileAssignmentChange" USING btree ("changedAt");


--
-- Name: MobileAssignmentChange_userId_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileAssignmentChange_userId_id_idx" ON public."MobileAssignmentChange" USING btree ("userId", id);


--
-- Name: MobileInstallation_installationKeyHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MobileInstallation_installationKeyHash_key" ON public."MobileInstallation" USING btree ("installationKeyHash");


--
-- Name: MobileInstallation_userId_app_revokedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileInstallation_userId_app_revokedAt_idx" ON public."MobileInstallation" USING btree ("userId", app, "revokedAt");


--
-- Name: MobileMutationReceipt_assignmentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileMutationReceipt_assignmentId_createdAt_idx" ON public."MobileMutationReceipt" USING btree ("assignmentId", "createdAt");


--
-- Name: MobileMutationReceipt_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileMutationReceipt_createdAt_idx" ON public."MobileMutationReceipt" USING btree ("createdAt");


--
-- Name: MobileMutationReceipt_installationId_actionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MobileMutationReceipt_installationId_actionId_key" ON public."MobileMutationReceipt" USING btree ("installationId", "actionId");


--
-- Name: MobileSession_idleExpiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileSession_idleExpiresAt_idx" ON public."MobileSession" USING btree ("idleExpiresAt");


--
-- Name: MobileSession_installationId_revokedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileSession_installationId_revokedAt_idx" ON public."MobileSession" USING btree ("installationId", "revokedAt");


--
-- Name: MobileSession_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MobileSession_tokenHash_key" ON public."MobileSession" USING btree ("tokenHash");


--
-- Name: MobileSession_userId_revokedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MobileSession_userId_revokedAt_idx" ON public."MobileSession" USING btree ("userId", "revokedAt");


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
-- Name: OperatingCenter_code_ci_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OperatingCenter_code_ci_key" ON public."OperatingCenter" USING btree (lower(TRIM(BOTH FROM code))) WHERE (NULLIF(TRIM(BOTH FROM code), ''::text) IS NOT NULL);


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
-- Name: PilotAssignmentRejection_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PilotAssignmentRejection_leadId_createdAt_idx" ON public."PilotAssignmentRejection" USING btree ("leadId", "createdAt");


--
-- Name: PilotAssignmentRejection_rejectedByPilotId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PilotAssignmentRejection_rejectedByPilotId_createdAt_idx" ON public."PilotAssignmentRejection" USING btree ("rejectedByPilotId", "createdAt");


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
-- Name: User_assignedLmvId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_assignedLmvId_key" ON public."User" USING btree ("assignedLmvId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_employeeCode_ci_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_employeeCode_ci_key" ON public."User" USING btree (lower(TRIM(BOTH FROM "employeeCode"))) WHERE (NULLIF(TRIM(BOTH FROM "employeeCode"), ''::text) IS NOT NULL);


--
-- Name: User_employeeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_employeeCode_key" ON public."User" USING btree ("employeeCode");


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_role_pilotAvailabilityState_homeCenterId_active_archivedAt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_pilotAvailabilityState_homeCenterId_active_archivedAt" ON public."User" USING btree (role, "pilotAvailabilityState", "homeCenterId", active, "archivedAt");


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
-- Name: Assignment Assignment_guard_operational_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Assignment_guard_operational_unit" BEFORE INSERT OR UPDATE OF "pilotId", "copilotId", "droneId", "copilotDroneId", "lmvId", "startedAt", "completedAt", "legacyCrewIncomplete", "crewFormationState" ON public."Assignment" FOR EACH ROW EXECUTE FUNCTION public.rfly_guard_assignment_unit();


--
-- Name: Assignment Assignment_mobile_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Assignment_mobile_change_feed" AFTER INSERT OR DELETE OR UPDATE ON public."Assignment" FOR EACH ROW EXECUTE FUNCTION public.rfly_record_assignment_mobile_change();


--
-- Name: CustomerHistory CustomerHistory_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "CustomerHistory_append_only" BEFORE DELETE OR UPDATE ON public."CustomerHistory" FOR EACH ROW EXECUTE FUNCTION public.rfly_prevent_history_mutation();


--
-- Name: Customer Customer_capture_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Customer_capture_history" AFTER INSERT OR UPDATE ON public."Customer" FOR EACH ROW EXECUTE FUNCTION public.rfly_capture_customer_history();


--
-- Name: Customer Customer_test_history_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Customer_test_history_cleanup" BEFORE DELETE ON public."Customer" FOR EACH ROW EXECUTE FUNCTION public.rfly_cleanup_history_for_test();


--
-- Name: DroneHistory DroneHistory_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "DroneHistory_append_only" BEFORE DELETE OR UPDATE ON public."DroneHistory" FOR EACH ROW EXECUTE FUNCTION public.rfly_prevent_history_mutation();


--
-- Name: Drone Drone_capture_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Drone_capture_history" AFTER INSERT OR UPDATE ON public."Drone" FOR EACH ROW EXECUTE FUNCTION public.rfly_capture_drone_history();


--
-- Name: Drone Drone_sync_asset_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Drone_sync_asset_state" BEFORE INSERT OR UPDATE OF status, "operationalState", "availabilityState" ON public."Drone" FOR EACH ROW EXECUTE FUNCTION public.rfly_sync_asset_state();


--
-- Name: Drone Drone_test_history_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Drone_test_history_cleanup" BEFORE DELETE ON public."Drone" FOR EACH ROW EXECUTE FUNCTION public.rfly_cleanup_history_for_test();


--
-- Name: HistoricalServiceRecord HistoricalServiceRecord_guard_source_outcome; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "HistoricalServiceRecord_guard_source_outcome" BEFORE INSERT OR UPDATE OF "sourceRecordId" ON public."HistoricalServiceRecord" FOR EACH ROW EXECUTE FUNCTION public.rfly_guard_import_outcome();


--
-- Name: LMVHistory LMVHistory_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "LMVHistory_append_only" BEFORE DELETE OR UPDATE ON public."LMVHistory" FOR EACH ROW EXECUTE FUNCTION public.rfly_prevent_history_mutation();


--
-- Name: LMV LMV_capture_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "LMV_capture_history" AFTER INSERT OR UPDATE ON public."LMV" FOR EACH ROW EXECUTE FUNCTION public.rfly_capture_lmv_history();


--
-- Name: LMV LMV_sync_asset_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "LMV_sync_asset_state" BEFORE INSERT OR UPDATE OF status, "operationalState", "availabilityState" ON public."LMV" FOR EACH ROW EXECUTE FUNCTION public.rfly_sync_asset_state();


--
-- Name: LMV LMV_test_history_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "LMV_test_history_cleanup" BEFORE DELETE ON public."LMV" FOR EACH ROW EXECUTE FUNCTION public.rfly_cleanup_history_for_test();


--
-- Name: LeadHistory LeadHistory_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "LeadHistory_append_only" BEFORE DELETE OR UPDATE ON public."LeadHistory" FOR EACH ROW EXECUTE FUNCTION public.rfly_prevent_history_mutation();


--
-- Name: Lead Lead_capture_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Lead_capture_history" AFTER INSERT OR UPDATE ON public."Lead" FOR EACH ROW EXECUTE FUNCTION public.rfly_capture_lead_history();


--
-- Name: Lead Lead_mobile_assignment_change_feed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Lead_mobile_assignment_change_feed" AFTER UPDATE OF status ON public."Lead" FOR EACH ROW EXECUTE FUNCTION public.rfly_record_lead_mobile_change();


--
-- Name: Lead Lead_test_history_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "Lead_test_history_cleanup" BEFORE DELETE ON public."Lead" FOR EACH ROW EXECUTE FUNCTION public.rfly_cleanup_history_for_test();


--
-- Name: SourceRecord SourceRecord_terminal_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "SourceRecord_terminal_evidence" BEFORE DELETE OR UPDATE ON public."SourceRecord" FOR EACH ROW EXECUTE FUNCTION public.rfly_guard_source_record_terminal_evidence();


--
-- Name: VillageVisit VillageVisit_guard_source_outcome; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "VillageVisit_guard_source_outcome" BEFORE INSERT OR UPDATE OF "sourceRecordId" ON public."VillageVisit" FOR EACH ROW EXECUTE FUNCTION public.rfly_guard_import_outcome();


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
-- Name: AutoAssignmentPolicy AutoAssignmentPolicy_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AutoAssignmentPolicy"
    ADD CONSTRAINT "AutoAssignmentPolicy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: Customer Customer_clusterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES public."Cluster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: Lead Lead_clusterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES public."Cluster"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: MobileInstallation MobileInstallation_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileInstallation"
    ADD CONSTRAINT "MobileInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MobileMutationReceipt MobileMutationReceipt_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileMutationReceipt"
    ADD CONSTRAINT "MobileMutationReceipt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MobileMutationReceipt MobileMutationReceipt_installationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileMutationReceipt"
    ADD CONSTRAINT "MobileMutationReceipt_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES public."MobileInstallation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MobileSession MobileSession_installationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileSession"
    ADD CONSTRAINT "MobileSession_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES public."MobileInstallation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MobileSession MobileSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MobileSession"
    ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


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
-- Name: PilotAssignmentRejection PilotAssignmentRejection_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotAssignmentRejection"
    ADD CONSTRAINT "PilotAssignmentRejection_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PilotAssignmentRejection PilotAssignmentRejection_rejectedByPilotId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotAssignmentRejection"
    ADD CONSTRAINT "PilotAssignmentRejection_rejectedByPilotId_fkey" FOREIGN KEY ("rejectedByPilotId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: User User_assignedLmvId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_assignedLmvId_fkey" FOREIGN KEY ("assignedLmvId") REFERENCES public."LMV"(id) ON UPDATE CASCADE ON DELETE SET NULL;


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

\unrestrict Y3icEAhXVZEHSpb5corI2nhHRI73Fhc6MSWzUa0Mgd9fWOACeqGsLEBkuNcYRDm

