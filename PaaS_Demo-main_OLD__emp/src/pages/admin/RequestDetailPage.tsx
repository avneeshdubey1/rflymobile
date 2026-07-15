import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatDateTimeIST } from '../../lib/time';
import { getPilotUsers } from '../../hooks/useDaasApp';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function RequestDetailPage({ user, app }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [pilotId, setPilotId] = useState('');
  const [representativeId, setRepresentativeId] = useState('');
  const [err, setErr] = useState('');

  if (!app.appData || !id) return null;
  const req = app.appData.requests.find(r => r.id === id);
  if (!req) return <EmptyState title="Request not found" description="This request may have been removed." />;

  const customer = app.appData.customers.find(c => c.id === req.customerId);
  const pilots = getPilotUsers(app.appData);
  const reps = app.appData.users.filter(u => u.role === 'Representative');
  const selectedPilot = pilotId || req.assignment?.pilotId || pilots[0]?.id || '';
  const selectedRepresentative = representativeId || req.assignment?.representativeId || reps[0]?.id || '';
  const assignedPilot = pilots.find(p => p.id === req.assignment?.pilotId);

  const run = async (task: () => Promise<unknown>, msg: string) => {
    try { setErr(''); await task(); toast(msg); } catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center hover:bg-surface-overlay transition-colors cursor-pointer" type="button">
          <Icon icon={ArrowLeft01Icon} size={16} />
        </button>
        <SectionHeader title={`Request ${req.id}`} description={`${customer?.name ?? 'Unknown'} · ${req.customerType === 'BB' ? 'B-B' : 'B-C'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Column - Details */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Request Info */}
          <article className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Request Details</h3>
              <StatusBadge status={req.status} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Crop Type', req.cropType],
                ['Field Area', `${req.fieldAreaAcres} acres`],
                ['Time Slot', req.requestedTimeSlot],
                ['Rate', `₹${req.amountPerAcre}/acre`],
                ['Source', req.sourceOfRequest],
                ['Chemical', req.chemical || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{val}</p>
                </div>
              ))}
            </div>
            {req.notes && <p className="mt-3 text-xs text-text-secondary bg-surface-overlay rounded-lg px-3 py-2">📝 {req.notes}</p>}
          </article>

          {/* Pilot Assignment (Admin) */}
          {user.role === 'Admin' && (
            <article className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Assignment Details</h3>
              {assignedPilot && (
                <div className="flex items-center gap-3 mb-3 p-3 bg-green-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">{assignedPilot.name.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{assignedPilot.name} (Pilot)</p>
                    <p className="text-[11px] text-text-muted">Assigned · {req.assignment?.assignedAt ? formatDateTimeIST(req.assignment.assignedAt) : ''}</p>
                  </div>
                </div>
              )}
              {req.customerType === 'BB' && req.assignment?.representativeId && (
                <div className="flex items-center gap-3 mb-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                    {app.appData.users.find(u => u.id === req.assignment?.representativeId)?.name.charAt(0) || 'R'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.appData.users.find(u => u.id === req.assignment?.representativeId)?.name || 'Unknown Representative'} (Rep)</p>
                    <p className="text-[11px] text-text-muted">Assigned for B-B Request</p>
                  </div>
                </div>
              )}
              {!assignedPilot && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-1 uppercase tracking-wider">Pilot</label>
                    <select value={selectedPilot} onChange={e => setPilotId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                      {pilots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  {req.customerType === 'BB' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-text-muted mb-1 uppercase tracking-wider">Representative</label>
                      <select value={selectedRepresentative} onChange={e => setRepresentativeId(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border-subtle bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button className="h-10 mt-2 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors cursor-pointer border-0" type="button" onClick={() => void run(() => app.assignPilot(req.id, selectedPilot, req.customerType === 'BB' ? selectedRepresentative : undefined, user), 'Assignment complete')}>
                    Assign Request
                  </button>
                </div>
              )}
            </article>
          )}

          {err && <p className="text-sm text-red-500 font-medium">{err}</p>}
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2">
          <article className="bg-white rounded-2xl border border-border-subtle p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Lifecycle Timeline</h3>
            <div className="flex flex-col gap-0">
              {req.statusEvents.map((evt, i) => (
                <div key={evt.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-200 shrink-0 mt-1" />
                    {i < req.statusEvents.length - 1 && <div className="w-0.5 flex-1 bg-border-subtle min-h-[24px]" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{evt.fromStatus}</span>
                      <span className="text-text-muted mx-1">→</span>
                      <span className="font-semibold">{evt.toStatus}</span>
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">{formatDateTimeIST(evt.at)} · {evt.actorUserId}</p>
                    {evt.note && <p className="text-[11px] text-text-secondary mt-0.5">{evt.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
