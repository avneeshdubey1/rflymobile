import { BootstrapResponseSchema, LoginResponseSchema } from '../src/api/auth';
import {
  BusinessDashboardSchema,
  BusinessNotificationsSchema,
  BusinessProfileSchema,
  BusinessRequestsSchema,
} from '../src/api/business';
import {
  FarmerDashboardResponseSchema,
  RequestOtpResponseSchema,
  SubmitRequestResponseSchema,
  VerifyOtpResponseSchema,
} from '../src/api/farmer';
import { EligibleCopilotsResponseSchema } from '../src/api/fleet';
import { MasterChoicesResponseSchema } from '../src/api/masterData';

const userId = 'de305d54-75b4-431b-adb2-eb6b9e546014';
const leadId = 'de305d54-75b4-431b-adb2-eb6b9e546015';

describe('Operations API runtime contracts', () => {
  it('accepts the nested mobile session contract and rejects the old flat token shape', () => {
    const valid = {
      success: true,
      session: { accessToken: 'opaque-access-token-at-least-20', tokenType: 'Bearer' },
      profile: { id: userId, displayName: 'RFLY Admin', role: 'ADMIN' },
    };
    expect(LoginResponseSchema.safeParse(valid).success).toBe(true);
    expect(VerifyOtpResponseSchema.safeParse(valid).success).toBe(true);
    expect(LoginResponseSchema.safeParse({ token: 'legacy', user: valid.profile }).success).toBe(false);
  });

  it('accepts the capability bootstrap and rejects the old user field', () => {
    expect(BootstrapResponseSchema.safeParse({
      success: true,
      profile: { id: userId, role: 'SALES' },
      capabilities: ['SALES_INTAKE', 'CUSTOMER_READ'],
    }).success).toBe(true);
    expect(BootstrapResponseSchema.safeParse({ user: { id: userId, role: 'SALES' } }).success).toBe(false);
  });

  it('validates Farmer OTP, dashboard, and accepted request DTOs', () => {
    expect(RequestOtpResponseSchema.safeParse({
      success: true,
      message: 'Verification code sent',
      challengeId: userId,
      resendAvailableAt: '2026-08-27T10:00:00.000Z',
    }).success).toBe(true);
    expect(FarmerDashboardResponseSchema.safeParse({
      success: true,
      history: [{ id: leadId, status: 'PENDING', area: '4', crop: 'Paddy', date: '2026-08-27T10:00:00.000Z' }],
    }).success).toBe(true);
    expect(SubmitRequestResponseSchema.safeParse({
      success: true,
      outcome: 'ACCEPTED',
      lead: {
        id: leadId,
        status: 'NEEDS_MANUAL_SCHEDULING',
        acreage: '4',
        crop: 'Paddy',
        operatingCenterId: null,
        createdAt: '2026-08-27T10:00:00.000Z',
      },
      assignmentOutcome: 'MANUAL_SCHEDULING',
    }).success).toBe(true);
  });

  it('validates Business isolation DTOs and rejects invented title/body fields', () => {
    expect(BusinessDashboardSchema.safeParse({
      success: true,
      summary: { totalRequests: 2, activeRequests: 1, recentActivity: [{ id: leadId, status: 'SCHEDULED', date: '2026-08-27T10:00:00.000Z' }] },
    }).success).toBe(true);
    expect(BusinessRequestsSchema.safeParse({
      success: true,
      requests: [{ id: leadId, crop: 'Paddy', area: '4', status: 'SCHEDULED', date: '2026-08-27T10:00:00.000Z' }],
    }).success).toBe(true);
    expect(BusinessProfileSchema.safeParse({
      success: true,
      profile: { name: 'Linked Farm Group', email: 'business@example.test', role: 'BUSINESS' },
    }).success).toBe(true);
    expect(BusinessNotificationsSchema.safeParse({
      success: true,
      notifications: [{ id: userId, type: 'PILOT_ASSIGNMENT', message: 'Update', readAt: null, createdAt: '2026-08-27T10:00:00.000Z' }],
    }).success).toBe(true);
    expect(BusinessNotificationsSchema.safeParse({
      success: true,
      notifications: [{ id: userId, title: 'Invented', body: 'Invented' }],
    }).success).toBe(false);
  });

  it('validates server-backed master data and staff copilot choices', () => {
    const choice = { id: userId, code: 'PADDY', displayName: 'Paddy' };
    expect(MasterChoicesResponseSchema.safeParse({
      success: true,
      data: {
        requestTypes: ['B2B', 'B2C'],
        clusterTypes: ['CLUSTER', 'HUB', 'SPOKE', 'MINIHUB'],
        clusters: [{ ...choice, type: 'CLUSTER' }],
        crops: [choice],
        sprayPurposes: [],
        b2bSubcategories: [],
        b2cClassifications: [],
        leadSources: [],
        reportingAdmins: [],
      },
    }).success).toBe(true);
    expect(EligibleCopilotsResponseSchema.safeParse({
      success: true,
      assignmentId: leadId,
      candidates: [{ id: userId, name: 'Copilot', employeeCode: 'P-1', homeCenterId: null }],
    }).success).toBe(true);
  });
});
