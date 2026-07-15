import { useCallback, useEffect, useMemo, useState } from 'react';
import { daasApi } from '../lib/api';
import type {
  AnalyticsSnapshot,
  AppData,
  CreateRequestInput,
  Customer,
  NotificationItem,
  ServiceRequest,
  User,
  TimeSlot,
  SystemConfig,
} from '../types/domain';

interface UseDaasAppState {
  loading: boolean;
  error: string | null;
  appData: AppData | null;
  analytics: AnalyticsSnapshot | null;
}

export interface UseDaasAppResult extends UseDaasAppState {
  refresh: () => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<{ token: string; user: User }>;
  signUp: (payload: { name: string; phone: string; role: 'BC' | 'BB'; businessName?: string; address?: string; region?: string }) => Promise<{ message: string }>;
  createRequest: (input: CreateRequestInput, actor: User) => Promise<ServiceRequest>;
  assignPilot: (requestId: string, pilotId: string, representativeId: string | undefined, actor: User) => Promise<ServiceRequest>;
  acceptJob: (requestId: string, actor: User) => Promise<ServiceRequest>;
  updateRepresentativeApproval: (
    requestId: string,
    payload: {
      representativeName: string;
      representativePhone: string;
      isApproved: boolean;
      rejectionReason?: string;
    },
    actor: User,
  ) => Promise<ServiceRequest>;
  startSpraying: (requestId: string, actor: User) => Promise<ServiceRequest>;
  completeSpraying: (requestId: string, actor: User) => Promise<ServiceRequest>;
  completeBBChecklist: (
    requestId: string,
    payload: { billCollected: boolean; billPhotoUrl?: string; screenshotUrl?: string },
    actor: User,
  ) => Promise<ServiceRequest>;
  recordBCPayment: (
    requestId: string,
    payload: { upiTransactionRef: string; amountPaid: number },
    actor: User,
  ) => Promise<ServiceRequest>;
  updateTracker: (requestId: string, notes: string, actor: User) => Promise<ServiceRequest>;
  generateInvoice: (customerId: string, actor: User) => Promise<void>;
  markNotificationRead: (notificationId: string, actor: User) => Promise<NotificationItem>;
  updateProfile: (payload: { name: string; phone: string }, actor: User) => Promise<User>;
  createUser: (payload: { name: string; phone: string; role: User['role']; address?: string; region?: string; billingCycleDays?: number }, actor: User) => Promise<User>;
  updateUserStatus: (userId: string, isActive: boolean, actor: User) => Promise<User>;
  deleteUser: (userId: string, actor: User) => Promise<void>;
  createTimeSlot: (slot: string, actor: User) => Promise<TimeSlot>;
  toggleTimeSlot: (id: string, isActive: boolean, actor: User) => Promise<TimeSlot>;
  deleteTimeSlot: (id: string, actor: User) => Promise<void>;
  updateConfig: (key: string, value: string, actor: User) => Promise<SystemConfig>;
}

type AppMutator<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export function useDaasApp(): UseDaasAppResult {
  const [state, setState] = useState<UseDaasAppState>({
    loading: true,
    error: null,
    appData: null,
    analytics: null,
  });

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('daas_token')) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const appData = await daasApi.getAppData();
      const currentUserId = localStorage.getItem('daas_user_id');
      const user = appData.users.find(u => u.id === currentUserId);
      
      // Ensure statusEvents is never undefined and has a fallback initial event
      appData.requests = appData.requests.map(r => {
        // Map Prisma relations to domain types
        const assignment = r.assignment;
        const representativeApproval = r.representativeApproval || (r as any).approval;
        const completionChecklist = r.completionChecklist || (r as any).checklist;
        const trackerEntry = r.trackerEntry || (r as any).tracker;
        const payment = r.payment;

        const events: any[] = [];

        // 1. Initial event
        events.push({
          id: `init-${r.id}`,
          requestId: r.id,
          fromStatus: 'Pending',
          toStatus: 'Pending',
          actorUserId: 'System',
          at: r.createdAt,
          note: 'Service request initialized'
        });

        // 2. Assigned
        if (assignment) {
          const pilotUser = appData.users.find(u => u.id === assignment.pilotId);
          const pilotName = pilotUser ? pilotUser.name : 'Pilot';
          events.push({
            id: `assign-${r.id}`,
            requestId: r.id,
            fromStatus: 'Pending',
            toStatus: 'Assigned',
            actorUserId: 'Admin',
            at: assignment.assignedAt,
            note: `Pilot assigned: ${pilotName}`
          });
        }

        // 3. Accepted
        if (assignment && assignment.acceptedAt) {
          const nextStatus = r.customerType === 'BB' ? 'RepresentativeApprovalPending' : 'Accepted';
          events.push({
            id: `accept-${r.id}`,
            requestId: r.id,
            fromStatus: 'Assigned',
            toStatus: nextStatus,
            actorUserId: 'Pilot',
            at: assignment.acceptedAt,
            note: 'Job accepted by pilot'
          });
        }

        // 4. Representative Approval (B-B)
        if (representativeApproval) {
          if (representativeApproval.approvedAt) {
            const nextStatus = representativeApproval.isApproved ? 'InProgress' : 'RepresentativeRejected';
            events.push({
              id: `approve-${r.id}`,
              requestId: r.id,
              fromStatus: 'RepresentativeApprovalPending',
              toStatus: nextStatus,
              actorUserId: 'Representative',
              at: representativeApproval.approvedAt,
              note: representativeApproval.isApproved 
                ? `Representative approved: ${representativeApproval.representativeName}` 
                : `Representative rejected: ${representativeApproval.rejectionReason || 'No reason specified'}`
            });
          } else if (representativeApproval.informedAt) {
            events.push({
              id: `inform-${r.id}`,
              requestId: r.id,
              fromStatus: 'RepresentativeApprovalPending',
              toStatus: 'RepresentativeApprovalPending',
              actorUserId: 'Pilot',
              at: representativeApproval.informedAt,
              note: `Representative informed: ${representativeApproval.representativeName} (${representativeApproval.representativePhone})`
            });
          }
        }

        // 5. Start Spraying
        if (assignment && assignment.startSprayingAt) {
          const fromStatus = r.customerType === 'BB' ? 'RepresentativeApprovalPending' : 'Accepted';
          events.push({
            id: `start-${r.id}`,
            requestId: r.id,
            fromStatus,
            toStatus: 'InProgress',
            actorUserId: 'Pilot',
            at: assignment.startSprayingAt,
            note: 'Spraying started'
          });
        }

        // 6. Complete Spraying
        if (assignment && assignment.completeSprayingAt) {
          events.push({
            id: `complete-${r.id}`,
            requestId: r.id,
            fromStatus: 'InProgress',
            toStatus: 'Completed',
            actorUserId: 'Pilot',
            at: assignment.completeSprayingAt,
            note: 'Spraying completed'
          });
        }

        // 7. Checklist
        if (completionChecklist) {
          events.push({
            id: `checklist-${r.id}`,
            requestId: r.id,
            fromStatus: 'Completed',
            toStatus: r.status,
            actorUserId: 'Pilot',
            at: completionChecklist.screenshotSharedAt || completionChecklist.representativeInformedAt,
            note: 'Completion checklist submitted (WhatsApp screenshot shared)'
          });
        }

        // 8. Payment
        if (payment) {
          events.push({
            id: `payment-${r.id}`,
            requestId: r.id,
            fromStatus: 'Completed',
            toStatus: 'PaymentReceived',
            actorUserId: 'Customer',
            at: payment.paidAt || payment.adminInformedAt,
            note: `Payment received: ₹${payment.amountPaid} via UPI (Ref: ${payment.upiTransactionRef})`
          });
        }

        // 9. Tracker
        if (trackerEntry) {
          const opsUser = appData.users.find(u => u.id === trackerEntry.updatedByOpsUserId);
          const opsName = opsUser ? opsUser.name : 'Ops';
          events.push({
            id: `tracker-${r.id}`,
            requestId: r.id,
            fromStatus: 'Completed',
            toStatus: 'TrackerUpdated',
            actorUserId: `Ops (${opsName})`,
            at: trackerEntry.updatedAt,
            note: `Tracker updated: ${trackerEntry.notes}`
          });
        }

        // 10. Invoiced
        if (r.status === 'Invoiced') {
          events.push({
            id: `invoice-${r.id}`,
            requestId: r.id,
            fromStatus: 'TrackerUpdated',
            toStatus: 'Invoiced',
            actorUserId: 'Finance',
            at: r.updatedAt,
            note: 'Invoice generated for customer billing'
          });
        }

        // Sort chronologically by timestamp ascending
        events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

        // Fix transitions fromStatus & toStatus chains to be perfectly logical
        for (let i = 1; i < events.length; i++) {
          events[i].fromStatus = events[i - 1].toStatus;
        }

        return {
          ...r,
          representativeApproval,
          completionChecklist,
          trackerEntry,
          statusEvents: events
        };
      });

      let analytics: AnalyticsSnapshot = {
        totalRequests: 0,
        activeRequests: 0,
        completionRate: 0,
        totalRevenue: 0,
      };

      if (user && (user.role === 'Admin' || user.role === 'Finance')) {
        analytics = await daasApi.getAnalytics();
      }

      setState({ loading: false, error: null, appData, analytics });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = useCallback(
    <TArgs extends unknown[], TResult>(mutation: AppMutator<TArgs, TResult>) =>
      async (...args: TArgs): Promise<TResult> => {
        const result = await mutation(...args);
        await refresh();
        return result;
      },
    [refresh],
  );

  return useMemo(
    () => ({
      ...state,
      refresh,
      sendOtp: async (phone: string) => daasApi.sendOtp(phone),
      verifyOtp: async (phone: string, otp: string) => daasApi.verifyOtp(phone, otp),
      signUp: async (payload: { name: string; phone: string; role: 'BC' | 'BB'; businessName?: string; address?: string; region?: string }) => daasApi.signUp(payload),
      createRequest: runMutation((input: CreateRequestInput, actor: User) => daasApi.createRequest(input, actor)),
      assignPilot: runMutation((requestId: string, pilotId: string, representativeId: string | undefined, actor: User) =>
        daasApi.assignPilot(requestId, pilotId, representativeId, actor),
      ),
      acceptJob: runMutation((requestId: string, actor: User) => daasApi.acceptJob(requestId, actor)),
      updateRepresentativeApproval: runMutation(
        (
          requestId: string,
          payload: {
            representativeName: string;
            representativePhone: string;
            isApproved: boolean;
            rejectionReason?: string;
          },
          actor: User,
        ) => daasApi.updateRepresentativeApproval(requestId, payload, actor),
      ),
      startSpraying: runMutation((requestId: string, actor: User) => daasApi.startSpraying(requestId, actor)),
      completeSpraying: runMutation((requestId: string, actor: User) => daasApi.completeSpraying(requestId, actor)),
      completeBBChecklist: runMutation(
        (
          requestId: string,
          payload: { billCollected: boolean; billPhotoUrl?: string; screenshotUrl?: string },
          actor: User,
        ) => daasApi.completeBBChecklist(requestId, payload, actor),
      ),
      recordBCPayment: runMutation(
        (requestId: string, payload: { upiTransactionRef: string; amountPaid: number }, actor: User) =>
          daasApi.recordBCPayment(requestId, payload, actor),
      ),
      updateTracker: runMutation((requestId: string, notes: string, actor: User) =>
        daasApi.updateTracker(requestId, notes, actor),
      ),
      generateInvoice: runMutation((customerId: string, actor: User) => daasApi.generateInvoice(customerId, actor).then(() => undefined)),
      markNotificationRead: runMutation((notificationId: string, actor: User) =>
        daasApi.markNotificationRead(notificationId, actor),
      ),
      updateProfile: runMutation((payload: { name: string; phone: string }, actor: User) =>
        daasApi.updateProfile(payload, actor).then(u => {
          localStorage.setItem('daas_user_id', u.id); // In case it's needed
          return u;
        })
      ),
      createUser: runMutation((payload: { name: string; phone: string; role: User['role']; address?: string; region?: string; billingCycleDays?: number }, actor: User) =>
        daasApi.createUser(payload, actor),
      ),
      updateUserStatus: runMutation((userId: string, isActive: boolean, actor: User) =>
        daasApi.updateUserStatus(userId, isActive, actor),
      ),
      deleteUser: runMutation((userId: string, actor: User) =>
        daasApi.deleteUser(userId, actor),
      ),
      createTimeSlot: runMutation((slot: string, actor: User) =>
        daasApi.createTimeSlot(slot, actor),
      ),
      toggleTimeSlot: runMutation((id: string, isActive: boolean, actor: User) =>
        daasApi.toggleTimeSlot(id, isActive, actor),
      ),
      deleteTimeSlot: runMutation((id: string, actor: User) =>
        daasApi.deleteTimeSlot(id, actor),
      ),
      updateConfig: runMutation((key: string, value: string, actor: User) =>
        daasApi.updateConfig(key, value, actor),
      ),
    }),
    [refresh, runMutation, state],
  );
}

export function getPilotUsers(appData: AppData | null): User[] {
  return appData?.users.filter((user) => user.role === 'Pilot') ?? [];
}

export function getCustomers(appData: AppData | null): Customer[] {
  return appData?.customers ?? [];
}

