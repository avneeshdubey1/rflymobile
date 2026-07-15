import type {
  AnalyticsSnapshot,
  AppData,
  CreateRequestInput,
  Invoice,
  NotificationItem,
  ServiceRequest,
  User,
  TimeSlot,
  SystemConfig,
} from '../../types/domain';

export interface DaasApi {
  getAppData(): Promise<AppData>;
  getAnalytics(): Promise<AnalyticsSnapshot>;
  createRequest(input: CreateRequestInput, actor: User): Promise<ServiceRequest>;
  assignPilot(requestId: string, pilotId: string, representativeId: string | undefined, actor: User): Promise<ServiceRequest>;
  acceptJob(requestId: string, actor: User): Promise<ServiceRequest>;
  updateRepresentativeApproval(
    requestId: string,
    payload: {
      representativeName: string;
      representativePhone: string;
      isApproved: boolean;
      rejectionReason?: string;
    },
    actor: User,
  ): Promise<ServiceRequest>;
  startSpraying(requestId: string, actor: User): Promise<ServiceRequest>;
  completeSpraying(requestId: string, actor: User): Promise<ServiceRequest>;
  completeBBChecklist(
    requestId: string,
    payload: {
      billCollected: boolean;
      billPhotoUrl?: string;
      screenshotUrl?: string;
    },
    actor: User,
  ): Promise<ServiceRequest>;
  recordBCPayment(
    requestId: string,
    payload: { upiTransactionRef: string; amountPaid: number },
    actor: User,
  ): Promise<ServiceRequest>;
  updateTracker(requestId: string, notes: string, actor: User): Promise<ServiceRequest>;
  generateInvoice(customerId: string, actor: User): Promise<Invoice>;
  markNotificationRead(notificationId: string, actor: User): Promise<NotificationItem>;
  
  // Auth
  signUp(payload: { name: string; phone: string; role: 'BC' | 'BB'; businessName?: string; address?: string; region?: string }): Promise<{ message: string }>;
  sendOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, otp: string): Promise<{ token: string; user: User }>;
  getMe(): Promise<User>;

  // User Management
  updateProfile(payload: { name: string; phone: string }, actor: User): Promise<User>;
  createUser(payload: { name: string; phone: string; role: User['role']; address?: string; region?: string; billingCycleDays?: number }, actor: User): Promise<User>;
  updateUserStatus(userId: string, isActive: boolean, actor: User): Promise<User>;
  deleteUser(userId: string, actor: User): Promise<void>;

  // Settings
  createTimeSlot(slot: string, actor: User): Promise<TimeSlot>;
  toggleTimeSlot(id: string, isActive: boolean, actor: User): Promise<TimeSlot>;
  deleteTimeSlot(id: string, actor: User): Promise<void>;
  updateConfig(key: string, value: string, actor: User): Promise<SystemConfig>;
}

