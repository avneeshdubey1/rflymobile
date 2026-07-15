import { UserIcon, Task01Icon, Analytics01Icon, Notification01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { SectionHeader } from '../../components/shared';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';
import { useNavigate } from 'react-router-dom';
import { formatDateTimeIST } from '../../lib/time';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface Props { user: User; app: UseDaasAppResult; }

export function RepresentativeDashboard({ user, app }: Props) {
  const nav = useNavigate();
  if (!app.appData || !app.analytics) return null;

  const myRequests = app.appData.requests.filter(r => r.assignment?.representativeId === user.id);
  const pendingApprovals = myRequests.filter(r => r.status === 'RepresentativeApprovalPending');
  const unreadCount = app.appData.notifications.filter(n => n.userId === user.id && !n.read).length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <SectionHeader title={`Hello, ${user.name.split(' ')[0]}`} description="Representative Dashboard" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
        <article className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon icon={Task01Icon} size={20} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{pendingApprovals.length}</p>
          <p className="text-xs text-text-muted font-medium mt-1">Pending Approvals</p>
        </article>

        <article className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon icon={Analytics01Icon} size={20} className="text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{myRequests.length}</p>
          <p className="text-xs text-text-muted font-medium mt-1">Total Assigned</p>
        </article>

        <article className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer" onClick={() => nav('/notifications')}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon icon={Notification01Icon} size={20} className="text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">{unreadCount}</p>
          <p className="text-xs text-text-muted font-medium mt-1">Alerts</p>
        </article>

        <article className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer" onClick={() => nav('/settings')}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon icon={UserIcon} size={20} className="text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-text-primary">Active</p>
          <p className="text-xs text-text-muted font-medium mt-1">Profile</p>
        </article>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        {/* Approvals Action Card */}
        <button
          onClick={() => nav('/approvals')}
          className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-left relative overflow-hidden"
          type="button"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon icon={Task01Icon} size={120} className="text-blue-500" />
          </div>
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
            <Icon icon={Task01Icon} size={28} className="text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">My Approvals</h3>
          <p className="text-sm text-text-secondary mb-6">Review and approve BB requests assigned to you.</p>
          <div className="flex items-center text-blue-600 font-semibold gap-2 group-hover:gap-3 transition-all">
            <span>View Approvals</span>
            <Icon icon={ArrowRight01Icon} size={20} />
          </div>
        </button>
      </div>

      {/* Recent Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Recent Pending Approvals</h2>
            <button onClick={() => nav('/approvals')} className="text-sm font-semibold text-green-600 hover:text-green-700 cursor-pointer">View All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApprovals.slice(0, 4).map(req => {
              const customer = app.appData!.customers.find(c => c.id === req.customerId);
              return (
                <div key={req.id} className="bg-white rounded-2xl p-4 border border-border-subtle shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-text-primary">SR-{req.id.slice(-6).toUpperCase()}</h4>
                      <p className="text-xs text-text-secondary mt-0.5">{customer?.name || 'Unknown Business'}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-border-subtle">
                    <p className="text-xs text-text-muted">{formatDateTimeIST(req.updatedAt)}</p>
                    <button onClick={() => nav('/approvals')} className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer">Review Now</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
