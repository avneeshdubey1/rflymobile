export const RequestStatus = {
  Pending: 'Pending',
  Assigned: 'Assigned',
  Accepted: 'Accepted',
  RepresentativeApprovalPending: 'RepresentativeApprovalPending',
  RepresentativeRejected: 'RepresentativeRejected',
  InProgress: 'InProgress',
  Completed: 'Completed',
  PaymentReceived: 'PaymentReceived',
  TrackerUpdated: 'TrackerUpdated',
  Invoiced: 'Invoiced',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const CustomerType = {
  BB: 'BB',
  BC: 'BC',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const UserRole = {
  Admin: 'Admin',
  Pilot: 'Pilot',
  Ops: 'Ops',
  Finance: 'Finance',
  BC: 'BC',
  BB: 'BB',
  Representative: 'Representative',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const RequestSource = {
  WalkIn: 'WalkIn',
  Phone: 'Phone',
  WhatsApp: 'WhatsApp',
  PartnerReferral: 'PartnerReferral',
  Other: 'Other',
} as const;
export type RequestSource = (typeof RequestSource)[keyof typeof RequestSource];

export const InvoiceStatus = {
  Draft: 'Draft',
  Sent: 'Sent',
  Paid: 'Paid',
  Overdue: 'Overdue',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const NotificationSeverity = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;
export type NotificationSeverity = (typeof NotificationSeverity)[keyof typeof NotificationSeverity];
