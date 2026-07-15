export type UserRole = 'Admin' | 'Pilot' | 'Ops' | 'Finance' | 'BC' | 'BB' | 'Representative';
export type CustomerType = 'BB' | 'BC';
export type RequestSource = 'WalkIn' | 'Phone' | 'WhatsApp' | 'PartnerReferral' | 'Other';

export type RequestStatus =
  | 'Pending'
  | 'Assigned'
  | 'Accepted'
  | 'RepresentativeApprovalPending'
  | 'RepresentativeRejected'
  | 'InProgress'
  | 'Completed'
  | 'PaymentReceived'
  | 'TrackerUpdated'
  | 'Invoiced';

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  customerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address: string;
  region: string;
  billingCycleDays: number;
  createdAt: string;
}

export interface PilotAssignment {
  id: string;
  serviceRequestId: string;
  pilotId: string;
  representativeId?: string;
  assignedAt: string;
  acceptedAt?: string;
  startSprayingAt?: string;
  completeSprayingAt?: string;
}

export interface BBRepresentativeApproval {
  id: string;
  serviceRequestId: string;
  representativeName: string;
  representativePhone: string;
  representativeUserId?: string;
  informedAt: string;
  isApproved: boolean;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface BCPayment {
  id: string;
  serviceRequestId: string;
  upiTransactionRef: string;
  amountPaid: number;
  paidAt: string;
  adminInformedAt: string;
}

export interface CompletionChecklist {
  id: string;
  serviceRequestId: string;
  representativeInformedAt: string;
  billCollected: boolean;
  billPhotoUrl?: string;
  screenshotSharedAt: string;
  screenshotUrl?: string;
}

export interface RequestTrackerEntry {
  id: string;
  serviceRequestId: string;
  updatedByOpsUserId: string;
  updatedAt: string;
  notes: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  jobIds: string[];
  totalAmount: number;
  invoiceDate: string;
  status: InvoiceStatus;
  pdfUrl?: string;
}

export interface StatusEvent {
  id: string;
  requestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  actorUserId: string;
  at: string;
  note?: string;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerType: CustomerType;
  cropType: string;
  fieldAreaAcres: number;
  requestedDate: string;
  requestedTimeSlot: string;
  chemical?: string;
  sourceOfRequest: RequestSource;
  status: RequestStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  amountPerAcre: number;
  assignment?: PilotAssignment;
  representativeApproval?: BBRepresentativeApproval;
  payment?: BCPayment;
  completionChecklist?: CompletionChecklist;
  trackerEntry?: RequestTrackerEntry;
  statusEvents: StatusEvent[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  severity: NotificationSeverity;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  totalRequests: number;
  activeRequests: number;
  completionRate: number;
  totalRevenue: number;
}

export interface TimeSlot {
  id: string;
  slot: string;
  isActive: boolean;
  createdAt: string;
}

export interface SystemConfig {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AppData {
  users: User[];
  customers: Customer[];
  requests: ServiceRequest[];
  invoices: Invoice[];
  notifications: NotificationItem[];
  timeSlots: TimeSlot[];
  configs: SystemConfig[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateRequestInput {
  customerId: string;
  customerType: CustomerType;
  cropType: string;
  fieldAreaAcres: number;
  requestedDate: string;
  requestedTimeSlot: string;
  chemical?: string;
  sourceOfRequest: RequestSource;
  notes?: string;
  amountPerAcre: number;
}

