import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckmarkCircle01Icon, DroneIcon, CreditCardIcon, Notification01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const stepLabels = ['Assigned', 'Accepted', 'In Progress', 'Completed', 'Post-Completion'];
function getStepIndex(status: string): number {
  if (status === 'Assigned') return 0;
  if (['Accepted', 'RepresentativeApprovalPending'].includes(status)) return 1;
  if (status === 'InProgress') return 2;
  if (status === 'Completed') return 3;
  return 4;
}

export function JobDetailPage({ user, app }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const [txRef, setTxRef] = useState('');
  const [amount, setAmount] = useState(0);

  if (!id || !app.appData) return null;
  const req = app.appData.requests.find(r => r.id === id);
  if (!req) return <EmptyState title="Job not found" description="This job no longer exists." />;
  if (user.role !== 'Pilot' || req.assignment?.pilotId !== user.id) return <ErrorState title="Restricted" description="Pilots can only access their own jobs." onRetry={() => nav('/pilot/jobs')} />;

  const step = getStepIndex(req.status);
  const run = async (task: () => Promise<unknown>, msg: string) => {
    try { setErr(''); await task(); toast(msg); } catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); }
  };

  const btnCls = "w-full h-14 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer border-0 transition-all active:scale-[0.98]";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center hover:bg-surface-overlay cursor-pointer transition-colors" type="button">
          <Icon icon={ArrowLeft01Icon} size={16} />
        </button>
        <SectionHeader title={`Job ${req.id}`} description={`${req.customerType === 'BB' ? 'B-B' : 'B-C'} workflow`} />
      </div>

      {/* Progress Stepper */}
      <div className="bg-white rounded-2xl border border-border-subtle p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <StatusBadge status={req.status} />
          <span className="text-xs text-text-muted">{req.cropType} · {req.fieldAreaAcres} acres</span>
        </div>
        <div className="flex items-center gap-0">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center relative">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 ${i <= step ? 'bg-green-500 text-white' : 'bg-gray-200 text-text-muted'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <p className={`text-[10px] mt-1.5 font-medium text-center ${i <= step ? 'text-green-600' : 'text-text-muted'}`}>{label}</p>
              {i < stepLabels.length - 1 && (
                <div className={`absolute top-3.5 left-[55%] w-[90%] h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 animate-slide-up">
        {req.status === 'Assigned' && (
          <button className={`${btnCls} bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-200`} type="button" onClick={() => void run(() => app.acceptJob(req.id, user), 'Job accepted')}>
            <Icon icon={CheckmarkCircle01Icon} size={18} /> Accept Job
          </button>
        )}

        {req.customerType === 'BB' && req.status === 'RepresentativeApprovalPending' && (
          <article className="bg-white rounded-2xl border border-amber-200 p-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">⚠️ B-B Approval Gate</h3>
              <p className="text-xs text-text-secondary">Waiting for representative approval before spraying can begin.</p>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
          </article>
        )}

        {req.status === 'Accepted' && (
          <button className={`${btnCls} bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-200`} type="button" onClick={() => void run(() => app.startSpraying(req.id, user), 'Spraying started')}>
            <Icon icon={DroneIcon} size={18} /> Start Spraying
          </button>
        )}

        {req.status === 'InProgress' && (
          <button className={`${btnCls} bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-200`} type="button" onClick={() => void run(() => app.completeSpraying(req.id, user), 'Spraying completed')}>
            <Icon icon={CheckmarkCircle01Icon} size={18} /> Complete Spraying
          </button>
        )}

        {req.customerType === 'BB' && req.status === 'Completed' && !req.completionChecklist && (
          <article className="bg-white rounded-2xl border border-border-subtle p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-2">B-B Completion Checklist</h3>
            <p className="text-xs text-text-secondary mb-3">Screenshot sharing to WhatsApp is mandatory.</p>
            <button className={`${btnCls} bg-green-500 text-white hover:bg-green-600`} type="button"
              onClick={() => void run(() => app.completeBBChecklist(req.id, { billCollected: true, billPhotoUrl: 'https://example.com/photo', screenshotUrl: 'https://example.com/wa' }, user), 'Checklist completed')}>
              <Icon icon={Notification01Icon} size={18} /> Confirm Bill + Screenshot
            </button>
          </article>
        )}

        {req.customerType === 'BC' && req.status === 'Completed' && !req.payment && (
          <article className="bg-white rounded-2xl border border-border-subtle p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-2">B-C Payment (RFLY UPI)</h3>
            <p className="text-xs text-text-secondary mb-3">Payment must be collected at point of service.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input className="flex-1 h-11 px-4 rounded-xl border border-border-subtle bg-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="UPI Txn Reference" value={txRef} onChange={e => setTxRef(e.target.value)} />
              <input className="w-full sm:w-32 h-11 px-4 rounded-xl border border-border-subtle bg-white text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-200" type="number" placeholder="Amount" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} />
              <button className="h-11 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 cursor-pointer border-0 flex items-center justify-center gap-2 transition-colors" type="button"
                onClick={() => void run(() => app.recordBCPayment(req.id, { upiTransactionRef: txRef, amountPaid: amount }, user), 'Payment recorded')}>
                <Icon icon={CreditCardIcon} size={16} /> Record
              </button>
            </div>
          </article>
        )}
      </div>

      {err && <p className="text-sm text-red-500 font-medium animate-fade-in">{err}</p>}
    </div>
  );
}
