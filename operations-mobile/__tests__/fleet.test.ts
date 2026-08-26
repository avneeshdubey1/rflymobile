import { ScheduleItemSchema, ExceptionItemSchema, CopilotOverrideResponseSchema } from '../src/api/fleet';

describe('Fleet DTO Schema Validation', () => {
  it('accepts valid schedule item DTO', () => {
    const valid = {
      id: 'a1',
      leadId: 'l1',
      revision: 1,
      status: 'SCHEDULED',
      crewFormationState: 'COMPLETE',
      dailySequence: 1,
      serviceWindow: {
        start: '2023-01-01T08:00:00.000Z',
        end: '2023-01-01T12:00:00.000Z',
        label: 'Morning',
      },
      farmerDisplayName: 'Ramesh',
      crop: 'Cotton',
      expectedAcreage: '5.5',
      operatingCenter: null,
      crew: {
        primaryPilot: { id: 'p1', displayName: 'Pilot A', employeeCode: 'EMP1' },
        copilot: null,
      },
      drone: { id: 'd1', code: 'DRONE1', serialNumber: 'SN1', status: 'ACTIVE' },
      lmv: null,
      issueCategory: null,
    };
    const result = ScheduleItemSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid schedule item DTO (invented flat fields)', () => {
    const invalid = {
      id: 'a1',
      pilotName: 'Pilot A', // invalid flat field!
      droneLabel: 'DRONE1', // invalid flat field!
      startTime: '2023-01-01T08:00:00.000Z', // invalid flat field!
    };
    const result = ScheduleItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts valid ASSIGNMENT exception DTO', () => {
    const valid = {
      type: 'ASSIGNMENT',
      id: 'a1',
      codes: ['DRONE_GROUNDED'],
      assignment: {
        id: 'a1',
        leadId: 'l1',
        revision: 1,
        status: 'SCHEDULED',
        crewFormationState: 'COMPLETE',
        dailySequence: 1,
        serviceWindow: { start: null, end: null, label: null },
        farmerDisplayName: 'Ramesh',
        crop: 'Cotton',
        expectedAcreage: '5.5',
        operatingCenter: null,
        crew: { primaryPilot: null, copilot: null },
        drone: { id: 'd1', code: 'DRONE1', serialNumber: 'SN1', status: 'GROUNDED' },
        lmv: null,
        issueCategory: 'EQUIPMENT',
      },
      lead: null,
    };
    const result = ExceptionItemSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts valid UNSCHEDULED_LEAD exception DTO', () => {
    const valid = {
      type: 'UNSCHEDULED_LEAD',
      id: 'l1',
      codes: ['NEEDS_MANUAL_SCHEDULING'],
      assignment: null,
      lead: {
        id: 'l1',
        farmerDisplayName: 'Ramesh',
        expectedAcreage: '5.5',
        crop: 'Cotton',
        createdAt: '2023-01-01T00:00:00.000Z',
        operatingCenter: null,
      },
    };
    const result = ExceptionItemSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
