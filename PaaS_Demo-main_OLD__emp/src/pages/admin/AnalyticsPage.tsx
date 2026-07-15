import { Analytics01Icon, CreditCardIcon, DroneIcon, Task01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { SectionHeader } from '../../components/shared';
import { formatCurrencyINR } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function AnalyticsPage({ app }: Props) {
  if (!app.appData || !app.analytics) return null;

  const reqs = app.appData.requests;
  const bbRevenue = reqs.filter(r => r.customerType === 'BB').reduce((s, r) => s + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);
  const bcRevenue = reqs.filter(r => r.customerType === 'BC').reduce((s, r) => s + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);
  const totalAcres = reqs.reduce((s, r) => s + Number(r.fieldAreaAcres), 0);
  const avgAcres = reqs.length > 0 ? (totalAcres / reqs.length).toFixed(1) : '0';

  const pilotStats = app.appData.users.filter(u => u.role === 'Pilot').map(p => {
    const jobs = reqs.filter(r => r.assignment?.pilotId === p.id);
    const completed = jobs.filter(j => ['Completed','PaymentReceived','TrackerUpdated','Invoiced'].includes(j.status));
    const acres = completed.reduce((s, r) => s + Number(r.fieldAreaAcres), 0);
    return { name: p.name, total: jobs.length, completed: completed.length, acres };
  });

  const customerStats = app.appData.customers.map(c => {
    const jobs = reqs.filter(r => r.customerId === c.id);
    const rev = jobs.reduce((s, r) => s + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);
    return { name: c.name, type: c.type, jobs: jobs.length, revenue: rev };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRev = app.analytics.totalRevenue;
  const bbPct = totalRev > 0 ? Math.round((bbRevenue / totalRev) * 100) : 0;
  const bcPct = totalRev > 0 ? 100 - bbPct : 0;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <SectionHeader title="Analytics & Reports" description="Platform performance insights and operational metrics." />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        {[
          { label: 'Total Requests', value: app.analytics.totalRequests, icon: Task01Icon, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Total Revenue', value: formatCurrencyINR(totalRev), icon: CreditCardIcon, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Avg Acres/Job', value: avgAcres, icon: DroneIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Completion Rate', value: `${app.analytics.completionRate}%`, icon: Analytics01Icon, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border-subtle p-5">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <Icon icon={s.icon} size={20} className={s.color} />
            </div>
            <p className="text-xl font-bold text-text-primary">{s.value}</p>
            <p className="text-xs text-text-muted font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Split */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Revenue by Customer Type</h3>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-lg font-bold text-blue-600">{formatCurrencyINR(bbRevenue)}</p>
              <p className="text-[11px] text-blue-500 font-medium mt-1">B-B ({bbPct}%)</p>
            </div>
            <div className="flex-1 text-center p-3 bg-green-50 rounded-xl">
              <p className="text-lg font-bold text-green-600">{formatCurrencyINR(bcRevenue)}</p>
              <p className="text-[11px] text-green-500 font-medium mt-1">B-C ({bcPct}%)</p>
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="bg-blue-500 rounded-l-full transition-all" style={{ width: `${bbPct}%` }} />
            <div className="bg-green-500 rounded-r-full transition-all" style={{ width: `${bcPct}%` }} />
          </div>
        </div>

        {/* Pilot Performance */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Pilot Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 text-xs font-semibold text-text-muted uppercase">Pilot</th>
                  <th className="text-center py-2 text-xs font-semibold text-text-muted uppercase">Jobs</th>
                  <th className="text-center py-2 text-xs font-semibold text-text-muted uppercase">Done</th>
                  <th className="text-right py-2 text-xs font-semibold text-text-muted uppercase">Acres</th>
                </tr>
              </thead>
              <tbody>
                {pilotStats.map(p => (
                  <tr key={p.name} className="border-b border-border-subtle last:border-0">
                    <td className="py-2.5 font-medium text-text-primary">{p.name}</td>
                    <td className="py-2.5 text-center text-text-secondary">{p.total}</td>
                    <td className="py-2.5 text-center text-green-600 font-medium">{p.completed}</td>
                    <td className="py-2.5 text-right text-text-secondary">{p.acres}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Customer Revenue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 text-xs font-semibold text-text-muted uppercase">Customer</th>
                <th className="text-center py-2 text-xs font-semibold text-text-muted uppercase">Type</th>
                <th className="text-center py-2 text-xs font-semibold text-text-muted uppercase">Jobs</th>
                <th className="text-right py-2 text-xs font-semibold text-text-muted uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {customerStats.map(c => (
                <tr key={c.name} className="border-b border-border-subtle last:border-0 hover:bg-surface-overlay/40 transition-colors">
                  <td className="py-2.5 font-medium text-text-primary">{c.name}</td>
                  <td className="py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${c.type === 'BB' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{c.type === 'BB' ? 'B-B' : 'B-C'}</span>
                  </td>
                  <td className="py-2.5 text-center text-text-secondary">{c.jobs}</td>
                  <td className="py-2.5 text-right font-semibold text-text-primary">{formatCurrencyINR(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
