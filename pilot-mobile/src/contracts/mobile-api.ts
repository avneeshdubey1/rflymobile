import { z } from "zod";

export const ZUuid = z.string().uuid();
export const ZTimestamp = z.string().datetime({ offset: true });
export const ZDecimal = z.string().regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/);

export const ZPilotRole = z.enum(["ADMIN", "FLEET_MANAGER", "SALES", "PILOT"]);
export const ZAppIdentity = z.enum(["PILOT_FIELD", "OPERATIONS"]);
export const ZPilotAvailabilityState = z.enum(["AVAILABLE", "OFFLINE"]);

export const ZPilotProfile = z.object({
  id: ZUuid,
  displayName: z.string().min(1).max(120),
  employeeCode: z.string().max(80).nullable(),
  preferredLanguage: z.string().min(2).max(12),
  homeCenterId: ZUuid.nullable(),
  role: ZPilotRole,
  pilotAvailabilityState: ZPilotAvailabilityState,
});

export const ZOperatingCenter = z.object({
  id: ZUuid,
  code: z.string().min(1).max(80),
  displayName: z.string().min(1).max(160),
});

export const ZCrewMember = z.object({
  id: ZUuid,
  displayName: z.string().min(1).max(120),
  crewRole: z.enum(["PRIMARY_PILOT", "COPILOT"]),
});

export const ZFarmer = z.object({
  displayName: z.string().min(1).max(120),
  operationalPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
});

export const ZFarm = z.object({
  displayAddress: z.string().min(1).max(300),
  plusCode: z.string().max(160).nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const ZIssue = z.object({
  category: z.enum([
    "DRONE_MALFUNCTION",
    "LMV_MALFUNCTION",
    "SAFETY_HAZARD",
    "WEATHER_BLOCKER",
    "CUSTOMER_BLOCKER",
    "OTHER",
  ]),
  note: z.string().min(1).max(500),
  reportedAt: ZTimestamp,
});

export const ZMaintenanceRequest = z.object({
  id: ZUuid,
  assetType: z.enum(["DRONE", "LMV"]),
  reasonCode: z.enum([
    "BATTERY_NOT_CHARGED",
    "PROPELLER_DAMAGED",
    "VEHICLE_BREAKDOWN",
    "TYRE_ISSUE",
    "ENGINE_ISSUE",
    "ELECTRICAL_ISSUE",
    "OTHER",
  ]),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "RESOLVED"]),
  processedBy: z.string().min(1).max(120).nullable(),
  updatedAt: ZTimestamp,
});

export const ZDrone = z.object({
  id: ZUuid,
  code: z.string().min(1).max(80),
  serialNumber: z.string().min(1).max(160),
});

export const ZLmv = z.object({
  id: ZUuid,
  registrationNumber: z.string().min(1).max(80),
  label: z.string().max(120).nullable(),
});

export const ZAssignmentAllowedAction = z.enum([
  "SELECT_COPILOT",
  "ACCEPT",
  "REJECT",
  "START",
  "COMPLETE",
  "REPORT_ISSUE",
  "SEND_LOCATION",
  "COLLECT_PAYMENT",
]);

export const ZCashCollection = z.object({
  id: ZUuid,
  amount: ZDecimal,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  method: z.literal("CASH"),
  reviewStatus: z.enum(["PENDING_REVIEW", "CONFIRMED", "VOIDED"]),
  recordedAt: ZTimestamp,
});

export const ZAssignment = z.object({
  id: ZUuid,
  leadId: ZUuid,
  revision: z.number().int().min(1),
  status: z.enum([
    "SCHEDULED",
    "PILOT_ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "FLAGGED",
  ]),
  requestType: z.enum(["B2B", "B2C"]).nullable(),
  crewFormationState: z.enum([
    "PENDING_COPILOT_SELECTION",
    "READY",
    "LEGACY_INCOMPLETE",
  ]),
  dailySequence: z.number().int().min(1),
  serviceWindowStart: ZTimestamp,
  serviceWindowEnd: ZTimestamp,
  farmer: ZFarmer,
  farm: ZFarm,
  crop: z.string().max(120).nullable(),
  expectedAcreage: ZDecimal,
  actualAcreage: ZDecimal.nullable(),
  issue: ZIssue.nullable(),
  maintenanceRequest: ZMaintenanceRequest.nullable(),
  cashCollection: ZCashCollection.nullable(),
  crew: z.array(ZCrewMember).min(1).max(2),
  drone: ZDrone,
  lmv: ZLmv.nullable(),
  operatingCenter: ZOperatingCenter.nullable(),
  operationalNotes: z.array(z.string().min(1).max(500)).max(10),
  updatedAt: ZTimestamp,
  allowedActions: z.array(ZAssignmentAllowedAction),
});

export const ZAssignmentListResponse = z.object({
  success: z.literal(true),
  assignments: z.array(ZAssignment).max(100),
});

export const ZAssignmentResponse = z.object({
  success: z.literal(true),
  assignment: ZAssignment,
});

export const ZCashCollectionResponse = z.object({
  success: z.literal(true),
  outcome: z.enum(["RECORDED", "ALREADY_RECORDED"]),
  collection: ZCashCollection,
});

export const ZPilotAvailabilityResponse = z.object({
  success: z.literal(true),
  profile: ZPilotProfile,
});

export const ZLocationResponse = z.object({
  success: z.literal(true),
  location: z.object({
    assignmentId: ZUuid,
    acceptedAt: ZTimestamp,
  }),
});

export const ZCopilotCandidate = z.object({
  id: ZUuid,
  name: z.string().min(1).max(120),
  employeeCode: z.string().max(80).nullable(),
  homeCenterId: ZUuid.nullable(),
});

export const ZEligibleCopilotsResponse = z.object({
  success: z.literal(true),
  assignmentId: ZUuid,
  candidates: z.array(ZCopilotCandidate).max(100),
});

export const ZLoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  installationKey: z.string().min(32).max(256),
  platform: z.literal("ANDROID"),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  deviceLabel: z.string().max(80).nullable(),
});

export const ZLoginResponse = z.object({
  success: z.literal(true),
  session: z.object({
    accessToken: z.string().min(32).max(512),
    tokenType: z.literal("Bearer"),
    idleExpiresAt: ZTimestamp,
    absoluteExpiresAt: ZTimestamp,
  }),
  installation: z.object({
    id: ZUuid,
    platform: z.literal("ANDROID"),
    appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
  profile: ZPilotProfile,
});

export const ZCapability = z.enum([
  "PILOT_ASSIGNMENTS_READ",
  "COPILOT_SELECT",
  "MISSION_MUTATE",
  "ISSUE_REPORT",
  "FOREGROUND_LOCATION",
  "OPERATIONS_OVERVIEW",
  "CUSTOMER_READ",
  "SALES_INTAKE",
  "FLEET_SCHEDULE",
  "CREW_OVERRIDE",
]);

export const ZBootstrapResponse = z.object({
  success: z.literal(true),
  apiVersion: z.literal("v1"),
  app: ZAppIdentity,
  serverTime: ZTimestamp,
  operatingTimeZone: z.string().min(1).max(80),
  profile: ZPilotProfile,
  operatingCenter: ZOperatingCenter.nullable(),
  assignmentWindow: z.object({
    from: ZTimestamp,
    to: ZTimestamp,
  }),
  assignments: z.array(ZAssignment).max(100),
  capabilities: z.array(ZCapability),
  featureFlags: z.object({
    chat: z.boolean(),
    foregroundLocation: z.boolean(),
    issueReporting: z.boolean(),
  }),
  appVersions: z.object({
    minimum: z.string().regex(/^\d+\.\d+\.\d+$/),
    recommended: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
  sync: z.object({
    cursor: z.string().min(1).max(512),
  }),
  policies: z.object({
    offlineGraceSeconds: z.number().int().min(0),
    terminalCacheSeconds: z.number().int().min(0),
    locationIntervalSeconds: z.number().int().min(1),
    locationAccuracyMetres: z.number().int().min(1),
    backgroundLocationEnabled: z.literal(false),
  }),
});

export const ZMutationOutcome = z.enum([
  "APPLIED",
  "ALREADY_APPLIED",
  "CONFLICT",
  "REJECTED",
  "RETRY_LATER",
]);

export const ZMutationReceipt = z.object({
  clientActionId: ZUuid,
  assignmentId: ZUuid,
  action: z.enum(["ACCEPT", "REJECT", "START", "COMPLETE", "REPORT_ISSUE", "LOCATION"]),
  outcome: ZMutationOutcome,
  resultingRevision: z.number().int().min(1),
  receivedAt: ZTimestamp,
});

export const ZMutationRequest = z
  .object({
    assignmentId: ZUuid,
    clientActionId: ZUuid,
    action: z.enum(["ACCEPT", "REJECT", "START", "COMPLETE", "REPORT_ISSUE"]),
    expectedRevision: z.number().int().min(1),
    actualAcreage: ZDecimal.optional(),
    issueCategory: ZIssue.shape.category.optional(),
    maintenanceReasonCode: z.enum([
      "BATTERY_NOT_CHARGED",
      "PROPELLER_DAMAGED",
      "VEHICLE_BREAKDOWN",
      "TYRE_ISSUE",
      "ENGINE_ISSUE",
      "ELECTRICAL_ISSUE",
      "OTHER",
    ]).optional(),
    issueNote: z.string().min(1).max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.action === "COMPLETE") return data.actualAcreage !== undefined;
      if (data.action === "REPORT_ISSUE")
        return data.issueCategory !== undefined && data.issueNote !== undefined;
      if (data.action === "REJECT") return data.issueNote !== undefined;
      return true;
    },
    { message: "Missing required payload for action" },
  );

export const ZSyncRequest = z.object({
  cursor: z.string().min(1).max(512),
  mutations: z.array(ZMutationRequest).min(1).max(20),
});

export const ZSyncResponse = z.object({
  success: z.literal(true),
  serverTime: ZTimestamp,
  mutationReceipts: z.array(ZMutationReceipt).max(20),
  nextCursor: z.string().min(1).max(512),
  fullResyncRequired: z.boolean(),
  changedAssignments: z.array(ZAssignment).max(100),
  removedAssignmentIds: z.array(ZUuid).max(100),
});

export const ZChangePage = z.object({
  success: z.literal(true),
  serverTime: ZTimestamp,
  nextCursor: z.string().min(1).max(512),
  fullResyncRequired: z.boolean(),
  changedAssignments: z.array(ZAssignment).max(100),
  removedAssignmentIds: z.array(ZUuid).max(100),
});

export const ZApiErrorCode = z.enum([
  "VALIDATION_FAILED",
  "AUTHENTICATION_REQUIRED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "CREDENTIAL_STATE_CHANGED",
  "ROLE_NOT_ALLOWED",
  "MOBILE_API_DISABLED",
  "INSTALLATION_NOT_ALLOWED",
  "INSTALLATION_LIMIT_REACHED",
  "RESOURCE_NOT_FOUND",
  "ASSIGNMENT_REVISION_CONFLICT",
  "ASSIGNMENT_REASSIGNED",
  "ASSIGNMENT_CANCELLED",
  "MISSION_STATE_CONFLICT",
  "SEQUENCE_BLOCKED",
  "ASSIGNMENT_LOCATION_INCOMPLETE",
  "PRIMARY_PILOT_REQUIRED",
  "CREW_FORMATION_NOT_PENDING",
  "COPILOT_REPLACEMENT_CLOSED",
  "COPILOT_SELECTION_DEADLINE_PASSED",
  "COPILOT_NOT_ELIGIBLE",
  "COPILOT_SELF_SELECTION",
  "COPILOT_CROSS_CENTRE",
  "COPILOT_LICENCE_EXPIRED",
  "COPILOT_SCHEDULE_CONFLICT",
  "LEGACY_CREW_REVIEW_REQUIRED",
  "RESOURCE_UNAVAILABLE",
  "ISSUE_REJECTED",
  "LOCATION_NOT_ALLOWED",
  "LOCATION_INVALID",
  "ACTIVE_ASSIGNMENT_BLOCKS_OFFLINE",
  "COLLECTION_NOT_ALLOWED",
  "COLLECTION_ALREADY_RECORDED",
  "ACTION_ID_REUSED",
  "RATE_LIMITED",
  "CLIENT_UPGRADE_REQUIRED",
  "RETRY_LATER",
  "INTERNAL_ERROR",
]);

export const ZApiErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: ZApiErrorCode,
    message: z.string().min(1).max(240),
    retryable: z.boolean(),
    requestId: z.string().min(1).max(128).optional(),
    details: z
      .object({
        assignmentId: ZUuid.optional(),
        currentRevision: z.number().int().min(1).optional(),
        blockedBySequence: z.number().int().min(1).optional(),
        retryAfterSeconds: z.number().int().min(1).optional(),
      })
      .optional(),
  }),
});

// Infer TypeScript types
export type PilotProfile = z.infer<typeof ZPilotProfile>;
export type OperatingCenter = z.infer<typeof ZOperatingCenter>;
export type Assignment = z.infer<typeof ZAssignment>;
export type AssignmentAllowedAction = z.infer<typeof ZAssignmentAllowedAction>;
export type CopilotCandidate = z.infer<typeof ZCopilotCandidate>;
export type CrewMember = z.infer<typeof ZCrewMember>;
export type Drone = z.infer<typeof ZDrone>;
export type Lmv = z.infer<typeof ZLmv>;
export type LoginRequest = z.infer<typeof ZLoginRequest>;
export type LoginResponse = z.infer<typeof ZLoginResponse>;
export type BootstrapResponse = z.infer<typeof ZBootstrapResponse>;
export type MutationRequest = z.infer<typeof ZMutationRequest>;
export type MutationReceipt = z.infer<typeof ZMutationReceipt>;
export type SyncRequest = z.infer<typeof ZSyncRequest>;
export type SyncResponse = z.infer<typeof ZSyncResponse>;
export type ChangePage = z.infer<typeof ZChangePage>;
export type ApiErrorResponse = z.infer<typeof ZApiErrorResponse>;
export type ApiErrorCode = z.infer<typeof ZApiErrorCode>;
