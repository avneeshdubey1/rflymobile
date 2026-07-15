import type { RequestStatus } from '../../types/domain';

const config: Record<RequestStatus, { bg: string; text: string; dot: string; label: string }> = {
  Pending:                        { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Pending' },
  Assigned:                       { bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', label: 'Assigned' },
  Accepted:                       { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-400',   label: 'Accepted' },
  RepresentativeApprovalPending:  { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Rep. Pending' },
  RepresentativeRejected:         { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500',    label: 'Rep. Rejected' },
  InProgress:                     { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'In Progress' },
  Completed:                      { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500',  label: 'Completed' },
  PaymentReceived:                { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-600',  label: 'Paid' },
  TrackerUpdated:                 { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Tracked' },
  Invoiced:                       { bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-500', label: 'Invoiced' },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
