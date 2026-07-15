export type Role = 'Admin' | 'Pilot' | 'Ops' | 'Finance'
export type CustomerType = 'BB' | 'BC'
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
  | 'Invoiced'

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'

export interface User {
  id: string
  name: string
  role: Role
  phone: string
  region: string
  avatar?: string
  isActive: boolean
}

export interface Pilot extends User {
  role: 'Pilot'
  activeJobCount: number
  skills: string[]
}

export interface RequestTimelineItem {
  id: string
  label: string
  at: string
  note?: string
}

export interface RepresentativeApproval {
  representativeName: string
  representativePhone: string
  informedAt: string
  isApproved: boolean
  approvedAt?: string
  rejectionReason?: string
}

export interface PaymentRecord {
  upiTransactionRef: string
  amountPaid: number
  paidAt: string
  adminInformedAt: string
}

export interface CompletionChecklist {
  representativeInformedAt?: string
  billCollected: boolean
  billPhotoNote?: string
  screenshotSharedAt?: string
  screenshotNote?: string
}

export interface RequestTrackerEntry {
  updatedAt: string
  updatedByOpsUserId: string
  notes: string
}

export interface Invoice {
  id: string
  customerName: string
  billingPeriodStart: string
  billingPeriodEnd: string
  jobIds: string[]
  totalAmount: number
  invoiceDate: string
  status: InvoiceStatus
  pdfUrl?: string
}

export interface ServiceRequest {
  id: string
  customerName: string
  customerType: CustomerType
  customerPhone: string
  region: string
  cropType: string
  fieldAreaAcres: number
  requestedDateTime: string
  chemical: string
  sourceOfRequest: 'WalkIn' | 'Phone' | 'WhatsApp' | 'PartnerReferral' | 'Other'
  notes: string
  status: RequestStatus
  assignedPilotId?: string
  assignedPilotName?: string
  assignmentAt?: string
  acceptedAt?: string
  startSprayingAt?: string
  completeSprayingAt?: string
  representativeApproval?: RepresentativeApproval
  payment?: PaymentRecord
  completionChecklist?: CompletionChecklist
  trackerEntry?: RequestTrackerEntry
  invoiceId?: string
  baseAmount: number
  timeline: RequestTimelineItem[]
}

export interface NotificationItem {
  id: string
  title: string
  description: string
  at: string
  level: 'info' | 'success' | 'warning' | 'danger'
  read: boolean
}

export interface CreateRequestInput {
  customerName: string
  customerType: CustomerType
  customerPhone: string
  region: string
  cropType: string
  fieldAreaAcres: number
  requestedDateTime: string
  chemical: string
  sourceOfRequest: ServiceRequest['sourceOfRequest']
  notes: string
}

export interface ApprovalInput {
  representativeName: string
  representativePhone: string
  isApproved: boolean
  rejectionReason?: string
}

export interface PaymentInput {
  upiTransactionRef: string
  amountPaid: number
}
