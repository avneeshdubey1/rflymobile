import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusSignIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User, RequestStatus, CustomerType } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function RequestsPage({ user, app }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | ''>('');

  if (!app.appData) return null;

  const customers = Object.fromEntries(app.appData.customers.map(c => [c.id, c]));
  const pilots = Object.fromEntries(app.appData.users.filter(u => u.role === 'Pilot').map(p => [p.id, p]));

  const filtered = app.appData.requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.customerType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const cName = customers[r.customerId]?.name?.toLowerCase() ?? '';
      if (!r.id.toLowerCase().includes(q) && !cName.includes(q) && !r.cropType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <SectionHeader
        title="Service Requests"
        description="Track all pending, active and completed drone spraying requests."
        action={user.role === 'Admin' ? (
          <Link to="/requests/new" className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 shadow-sm shadow-green-200 transition-all">
            <Icon icon={PlusSignIcon} size={16} /> New Request
          </Link>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
        <input
          type="text"
          placeholder="Search by ID, customer, or crop..."
          className="flex-1 h-11 px-4 rounded-xl border border-border-subtle bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="h-11 px-3 rounded-xl border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as RequestStatus | '')}
        >
          <option value="">All Statuses</option>
          {(['Pending','Assigned','Accepted','InProgress','Completed','PaymentReceived','TrackerUpdated','Invoiced'] as RequestStatus[]).map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as CustomerType | '')}
        >
          <option value="">All Types</option>
          <option value="BB">B-B (Business)</option>
          <option value="BC">B-C (Consumer)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No requests found" description={search || statusFilter || typeFilter ? 'Try adjusting your filters.' : 'Create your first request to start operations.'} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-border-subtle overflow-hidden animate-slide-up">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-overlay/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">ID</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Crop</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Acres</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Pilot</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-surface-overlay/40 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-text-primary">{r.id}</td>
                      <td className="px-5 py-3.5 text-text-secondary">{customers[r.customerId]?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${r.customerType === 'BB' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {r.customerType === 'BB' ? 'B-B' : 'B-C'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">{r.cropType}</td>
                      <td className="px-5 py-3.5 text-text-secondary">{r.fieldAreaAcres}</td>
                      <td className="px-5 py-3.5 text-text-muted text-xs">{formatDateIST(r.requestedDate)}</td>
                      <td className="px-5 py-3.5 text-text-secondary text-xs">{r.assignment ? pilots[r.assignment.pilotId]?.name ?? r.assignment.pilotId : '—'}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="px-5 py-3.5">
                        <Link to={`/requests/${r.id}`} className="text-blue-500 hover:text-blue-600"><Icon icon={ArrowRight01Icon} size={16} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3 animate-slide-up">
            {filtered.map(r => (
              <Link key={r.id} to={`/requests/${r.id}`} className="bg-white rounded-2xl border border-border-subtle p-4 flex flex-col gap-2 hover:shadow-md transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-primary">{r.id}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm text-text-secondary">{customers[r.customerId]?.name ?? '—'} · <span className="font-medium">{r.customerType === 'BB' ? 'B-B' : 'B-C'}</span></p>
                <p className="text-xs text-text-muted">{r.cropType} · {r.fieldAreaAcres} acres · {formatDateIST(r.requestedDate)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-text-muted">{r.assignment ? `Pilot: ${pilots[r.assignment.pilotId]?.name ?? r.assignment.pilotId}` : 'Unassigned'}</span>
                  <Icon icon={ArrowRight01Icon} size={14} className="text-text-muted" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
