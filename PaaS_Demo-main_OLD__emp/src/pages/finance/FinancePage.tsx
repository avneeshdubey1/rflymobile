import { useState } from 'react';
import { AddInvoiceIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatCurrencyINR, formatDateIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-50 text-blue-600', Paid: 'bg-green-50 text-green-600', Overdue: 'bg-red-50 text-red-600',
};

export function FinancePage({ user, app }: Props) {
  const [err, setErr] = useState('');
  if (!app.appData) return null;
  const appData = app.appData;
  if (!['Finance', 'Admin'].includes(user.role)) return <ErrorState title="Access denied" description="Invoices are handled by finance and admin users." onRetry={() => void app.refresh()} />;

  const bbCustomers = appData.customers.filter(c => c.type === 'BB');
  const totalRev = appData.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

  const gen = async (customerId: string) => {
    try { setErr(''); await app.generateInvoice(customerId, user); toast('Invoice generated'); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <SectionHeader title="Finance & Invoices" description="Generate B-B invoices after Ops tracker updates." />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in">
        <div className="bg-white rounded-2xl border border-border-subtle p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{formatCurrencyINR(totalRev)}</p>
          <p className="text-[11px] text-text-muted font-medium mt-1">Total Invoiced</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-subtle p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{app.appData.invoices.length}</p>
          <p className="text-[11px] text-text-muted font-medium mt-1">Total Invoices</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-subtle p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{bbCustomers.length}</p>
          <p className="text-[11px] text-text-muted font-medium mt-1">B-B Customers</p>
        </div>
      </div>

      {/* Customer Cards */}
      <h3 className="text-sm font-semibold text-text-primary">B-B Customers</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
        {bbCustomers.map(c => {
          const eligibleCount = appData.requests.filter(r => r.customerId === c.id && r.status === 'TrackerUpdated').length;

          return (
            <article key={c.id} className="bg-white rounded-2xl border border-border-subtle p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">{c.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                      <p className="text-[11px] text-text-muted">Billing: every {c.billingCycleDays} days</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eligibleCount > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                    {eligibleCount} eligible
                  </span>
                </div>
                
                {eligibleCount === 0 && (
                  <p className="text-[10px] text-text-muted bg-gray-50 rounded-lg p-2.5 mb-4 border border-border-subtle/50 leading-relaxed">
                    ℹ️ A Pilot must first complete the spraying job, and Ops/Admin must submit tracker log notes before an invoice can be generated.
                  </p>
                )}
              </div>
              <button className={`w-full h-10 rounded-xl text-sm font-semibold transition-all border-0 flex items-center justify-center gap-2 ${eligibleCount > 0 ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer shadow-sm shadow-green-500/10' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} type="button" disabled={eligibleCount === 0} onClick={() => void gen(c.id)}>
                <Icon icon={AddInvoiceIcon} size={16} /> Generate Invoice
              </button>
            </article>
          );
        })}
      </div>

      {err && <p className="text-sm text-red-500 font-medium">{err}</p>}

      {/* Invoice List */}
      <h3 className="text-sm font-semibold text-text-primary mt-2">Invoice History</h3>
      {appData.invoices.length === 0 ? (
        <EmptyState title="No invoices" description="Generate your first invoice from an eligible B-B customer." />
      ) : (
        <div className="bg-white rounded-2xl border border-border-subtle overflow-hidden animate-slide-up">
          <div className="divide-y divide-border-subtle">
            {appData.invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-surface-overlay/40 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{inv.id}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatDateIST(inv.invoiceDate)} · {inv.jobIds.length} jobs</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-text-primary">{formatCurrencyINR(inv.totalAmount)}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[inv.status] ?? ''}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
