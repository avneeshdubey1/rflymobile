import { CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatDateTimeIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User, NotificationSeverity } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const sevColors: Record<NotificationSeverity, { bg: string; dot: string }> = {
  info: { bg: 'bg-blue-50', dot: 'bg-blue-500' },
  success: { bg: 'bg-green-50', dot: 'bg-green-500' },
  warning: { bg: 'bg-amber-50', dot: 'bg-amber-500' },
  error: { bg: 'bg-red-50', dot: 'bg-red-500' },
};

export function NotificationsPage({ user, app }: Props) {
  if (!app.appData) return null;
  const list = app.appData.notifications.filter(n => n.userId === user.id);
  const unread = list.filter(n => !n.read);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <SectionHeader
        title="Notifications"
        description={`${unread.length} unread alert${unread.length !== 1 ? 's' : ''}`}
        action={unread.length > 0 ? (
          <button
            className="text-xs font-semibold text-blue-500 hover:text-blue-600 cursor-pointer bg-transparent border-0"
            type="button"
            onClick={() => { unread.forEach(n => void app.markNotificationRead(n.id, user)); toast('All marked as read'); }}
          >
            Mark all as read
          </button>
        ) : undefined}
      />

      {list.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <div className="flex flex-col gap-3 animate-slide-up">
          {list.map(n => {
            const sev = sevColors[n.severity];
            return (
              <article key={n.id} className={`rounded-2xl border border-border-subtle p-4 transition-all ${n.read ? 'bg-white' : sev.bg}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-text-primary truncate">{n.title}</h4>
                      {!n.read && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">New</span>}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">{n.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-text-muted">{formatDateTimeIST(n.createdAt)}</span>
                      {!n.read && (
                        <button
                          className="text-xs font-medium text-blue-500 hover:text-blue-600 cursor-pointer bg-transparent border-0 flex items-center gap-1"
                          type="button"
                          onClick={() => void app.markNotificationRead(n.id, user).then(() => toast('Marked as read'))}
                        >
                          <Icon icon={CheckmarkCircle01Icon} size={14} /> Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
