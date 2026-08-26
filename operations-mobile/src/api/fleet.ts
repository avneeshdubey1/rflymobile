import { fetchApi } from './client';
import { z } from 'zod';

export const CrewMemberSchema = z.object({
  id: z.string(),
  displayName: z.string().optional().nullable(),
  employeeCode: z.string().optional().nullable(),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;

export const OperatingCenterSchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
});
export type OperatingCenter = z.infer<typeof OperatingCenterSchema>;

export const ScheduleItemSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  revision: z.number(),
  status: z.string(),
  crewFormationState: z.string(),
  dailySequence: z.number().nullable().optional(),
  serviceWindow: z.object({
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
  }),
  farmerDisplayName: z.string(),
  crop: z.string().nullable().optional(),
  expectedAcreage: z.string(),
  operatingCenter: OperatingCenterSchema.nullable().optional(),
  crew: z.object({
    primaryPilot: CrewMemberSchema.nullable().optional(),
    copilot: CrewMemberSchema.nullable().optional(),
  }),
  drone: z.object({
    id: z.string(),
    code: z.string(),
    serialNumber: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  }),
  lmv: z.object({
    id: z.string(),
    registrationNumber: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  }).nullable().optional(),
  issueCategory: z.string().nullable().optional(),
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

export const ExceptionItemSchema = z.object({
  type: z.enum(['ASSIGNMENT', 'UNSCHEDULED_LEAD']),
  id: z.string(),
  codes: z.array(z.string()),
  assignment: ScheduleItemSchema.nullable().optional(),
  lead: z.object({
    id: z.string(),
    farmerDisplayName: z.string(),
    expectedAcreage: z.string(),
    crop: z.string().nullable().optional(),
    createdAt: z.string(),
    operatingCenter: OperatingCenterSchema.nullable().optional(),
  }).nullable().optional(),
});
export type ExceptionItem = z.infer<typeof ExceptionItemSchema>;

export const ScheduleResponseSchema = z.object({
  success: z.boolean(),
  from: z.string(),
  to: z.string(),
  assignments: z.array(ScheduleItemSchema),
});

export const ExceptionsResponseSchema = z.object({
  success: z.boolean(),
  from: z.string(),
  to: z.string(),
  exceptions: z.array(ExceptionItemSchema),
});

export const CopilotOverrideResponseSchema = z.object({
  success: z.boolean(),
  assignment: ScheduleItemSchema.optional(),
});

export const fleetApi = {
  getSchedule: (from: string, to: string) => 
    fetchApi(`/api/mobile/v1/operations/fleet/schedule?from=${from}&to=${to}`, {}, ScheduleResponseSchema, { dataset: 'customerSummary', key: `schedule_${from}_${to}` }),
    
  getExceptions: (from: string, to: string) => 
    fetchApi(`/api/mobile/v1/operations/fleet/exceptions?from=${from}&to=${to}`, {}, ExceptionsResponseSchema, { dataset: 'customerSummary', key: `exceptions_${from}_${to}` }),
    
  overrideAssignment: (assignmentId: string, candidateId: string, expectedRevision: number, reason: string) => 
    fetchApi(`/api/mobile/v1/operations/assignments/${assignmentId}/copilot-override`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, expectedRevision, reason }),
    }, CopilotOverrideResponseSchema),
};
