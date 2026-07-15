import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft01Icon, Task01Icon, CheckmarkCircle02Icon, CancelCircleIcon, DroneIcon, SmartPhone01Icon, Note01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { formatDateTimeIST } from '../../lib/time';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User, ServiceRequest } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function RepresentativeApprovalsPage({ user, app }: Props) {
  const nav = useNavigate();
  const [selectedReq, setSelectedReq] = useState<ServiceRequest | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState<'tracking' | 'action'>('tracking');
  const [trackerNotes, setTrackerNotes] = useState('');
  const [isUpdatingTracker, setIsUpdatingTracker] = useState(false);
  const [isSimulatingCall, setIsSimulatingCall] = useState(false);

  if (!app.appData) return null;

  const myRequests = app.appData.requests.filter(r => r.assignment?.representativeId === user.id);
  const pendingApprovals = myRequests.filter(r => r.status === 'RepresentativeApprovalPending');
  const pastApprovals = myRequests.filter(r => r.representativeApproval?.approvedAt || (r.assignment?.representativeId === user.id && r.status !== 'RepresentativeApprovalPending'));

  const selectRequest = (req: ServiceRequest) => {
    setSelectedReq(req);
    setIsApproved(req.representativeApproval?.isApproved ?? true);
    setRejectionReason(req.representativeApproval?.rejectionReason ?? '');
    setErr('');
    setTrackerNotes('');
    setActiveTab(req.status === 'RepresentativeApprovalPending' ? 'action' : 'tracking');
  };

  const handleSubmitApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    if (!isApproved && !rejectionReason.trim()) {
      setErr('Reason is required for rejection');
      return;
    }

    try {
      setErr('');
      await app.updateRepresentativeApproval(
        selectedReq.id,
        {
          representativeName: user.name,
          representativePhone: user.phone,
          isApproved,
          rejectionReason: isApproved ? undefined : rejectionReason,
        },
        user
      );
      toast(isApproved ? 'Request approved successfully' : 'Request rejected');
      setSelectedReq(null);
      setRejectionReason('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Approval failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 relative">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center hover:bg-surface-overlay transition-colors cursor-pointer" type="button">
          <Icon icon={ArrowLeft01Icon} size={16} />
        </button>
        <SectionHeader title="My Approvals" description="Manage BB requests pending your approval" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-primary px-1">Pending Action ({pendingApprovals.length})</h3>
          
          {pendingApprovals.length === 0 ? (
            <EmptyState title="No Pending Approvals" description="You have no requests waiting for your approval right now." />
          ) : (
            pendingApprovals.map(req => {
              const customer = app.appData!.customers.find(c => c.id === req.customerId);
              return (
                <article key={req.id} className="bg-white rounded-2xl border border-border-subtle p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-text-primary text-lg">SR-{req.id.slice(-6).toUpperCase()}</h4>
                      <p className="text-sm text-text-secondary mt-1">{customer?.name || 'Unknown Business'}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-surface-overlay rounded-xl">
                    <div>
                      <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider">Crop</p>
                      <p className="text-sm font-medium text-text-primary mt-1">{req.cropType}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider">Area</p>
                      <p className="text-sm font-medium text-text-primary mt-1">{req.fieldAreaAcres} acres</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider">Chemical</p>
                      <p className="text-sm font-medium text-text-primary mt-1">{req.chemical || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider">Assigned At</p>
                      <p className="text-sm font-medium text-text-primary mt-1">{req.assignment?.assignedAt ? formatDateTimeIST(req.assignment.assignedAt).split(' ')[0] : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-4 border-t border-border-subtle">
                    <button 
                      onClick={() => selectRequest(req)}
                      className="h-10 px-6 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer border-0 shadow-sm"
                    >
                      Review & Action
                    </button>
                  </div>
                </article>
              );
            })
          )}

          <h3 className="text-sm font-semibold text-text-primary px-1 mt-6">All Assigned Jobs ({myRequests.length})</h3>
          {pastApprovals.length === 0 ? (
            <p className="text-sm text-text-muted italic px-1">No requests assigned yet.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-border-subtle overflow-hidden">
              {pastApprovals.map((req, i) => {
                const customer = app.appData!.customers.find(c => c.id === req.customerId);
                return (
                  <div key={req.id} className={`p-4 flex items-center justify-between ${i !== 0 ? 'border-t border-border-subtle' : ''} hover:bg-surface-overlay transition-colors cursor-pointer`} onClick={() => selectRequest(req)}>
                    <div>
                      <p className="font-semibold text-sm text-text-primary">SR-{req.id.slice(-6).toUpperCase()} · {customer?.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {req.representativeApproval?.approvedAt 
                          ? `${req.representativeApproval.isApproved ? 'Approved' : 'Rejected'} · ${formatDateTimeIST(req.representativeApproval.approvedAt)}`
                          : `Status: ${req.status}`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {req.representativeApproval?.approvedAt ? (
                        req.representativeApproval?.isApproved ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md"><Icon icon={CheckmarkCircle02Icon} size={14} /> Approved</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-md"><Icon icon={CancelCircleIcon} size={14} /> Rejected</span>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{req.status}</span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-500 hover:underline">
                        View & Track &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar - Action Form */}
        <div className="lg:col-span-1">
          {selectedReq ? (
            <div className="bg-white rounded-2xl border border-border-subtle p-5 sticky top-24 shadow-lg animate-slide-up flex flex-col gap-4">
              <div className="flex justify-between items-start border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-base font-bold text-text-primary">SR-{selectedReq.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{app.appData.customers.find(c => c.id === selectedReq.customerId)?.name || 'B-B Client'}</p>
                </div>
                <StatusBadge status={selectedReq.status} />
              </div>

              {selectedReq.status === 'RepresentativeApprovalPending' ? (
                <div className="flex bg-surface-overlay p-1 rounded-xl border border-border-subtle">
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('tracking')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer border-0 ${activeTab === 'tracking' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    Track Pilot
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setActiveTab('action')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer border-0 ${activeTab === 'action' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    Action Needed
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-xl flex items-center gap-2">
                  <Icon icon={DroneIcon} size={16} />
                  <p className="text-xs font-semibold font-sans">Pilot Tracker Mode Enabled</p>
                </div>
              )}

              {(activeTab === 'tracking' || selectedReq.status !== 'RepresentativeApprovalPending') ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Pilot Profile Section */}
                  <div>
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Assigned Pilot</h4>
                    {(() => {
                      const pilot = app.appData!.users.find(u => u.id === selectedReq.assignment?.pilotId);
                      if (!pilot) {
                        return (
                          <div className="p-3 bg-surface-overlay border border-dashed border-border-subtle rounded-xl text-center">
                            <p className="text-xs text-text-muted">No pilot assigned yet.</p>
                          </div>
                        );
                      }
                      
                      const totalJobs = app.appData!.requests.filter(r => r.assignment?.pilotId === pilot.id).length;
                      const completedJobs = app.appData!.requests.filter(r => r.assignment?.pilotId === pilot.id && r.status === 'Completed').length;

                      return (
                        <div className="p-4 bg-surface-overlay rounded-2xl border border-border-subtle flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-green-500/20">
                              {pilot.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-semibold text-text-primary">{pilot.name}</p>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              </div>
                              <p className="text-xs text-text-muted">Verified Spraying Pilot</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50 text-center">
                            <div className="bg-white rounded-lg p-1.5 border border-border-subtle">
                              <p className="text-[9px] text-text-muted font-bold uppercase">Flights</p>
                              <p className="text-xs font-semibold text-text-primary mt-0.5">{totalJobs}</p>
                            </div>
                            <div className="bg-white rounded-lg p-1.5 border border-border-subtle">
                              <p className="text-[9px] text-text-muted font-bold uppercase">Success Rate</p>
                              <p className="text-xs font-semibold text-text-primary mt-0.5">
                                {totalJobs > 0 ? `${Math.round((completedJobs / totalJobs) * 100)}%` : '100%'}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSimulatingCall(true);
                                setTimeout(() => setIsSimulatingCall(false), 2500);
                              }}
                              className="flex-1 h-9 rounded-xl bg-white border border-border-subtle text-text-secondary text-xs font-semibold hover:bg-surface-overlay transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Icon icon={SmartPhone01Icon} size={14} />
                              Call Pilot
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Telemetry & Live Tracking */}
                  <div>
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Operation Status Tracker</h4>
                    <div className="bg-surface-overlay rounded-2xl border border-border-subtle p-4 flex flex-col gap-4">
                      {(() => {
                        const currentStatus = selectedReq.status;
                        const steps = [
                          {
                            label: 'Job Allocation',
                            desc: 'Admin assigned a pilot to this request',
                            done: ['Assigned', 'Accepted', 'RepresentativeApprovalPending', 'InProgress', 'Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(currentStatus),
                            active: currentStatus === 'Pending'
                          },
                          {
                            label: 'Pilot Acceptance',
                            desc: 'Pilot accepted and confirmed flight details',
                            done: ['Accepted', 'RepresentativeApprovalPending', 'InProgress', 'Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(currentStatus),
                            active: currentStatus === 'Assigned'
                          },
                          {
                            label: 'Representative Approval',
                            desc: 'Flight clearance and representative approval',
                            done: ['InProgress', 'Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(currentStatus),
                            active: ['Accepted', 'RepresentativeApprovalPending'].includes(currentStatus)
                          },
                          {
                            label: 'Spraying Operation',
                            desc: 'Active flight spraying and crop drone treatment',
                            done: ['Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(currentStatus),
                            active: currentStatus === 'InProgress'
                          },
                          {
                            label: 'Submission & Closeout',
                            desc: 'Operations checklist, bill photo, and final sync',
                            done: ['PaymentReceived', 'TrackerUpdated', 'Invoiced'].includes(currentStatus),
                            active: currentStatus === 'Completed'
                          }
                        ];

                        return (
                          <div className="relative flex flex-col gap-5 pl-4 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border-subtle">
                            {steps.map((st, idx) => (
                              <div key={idx} className="relative flex flex-col gap-1">
                                <div className={`absolute -left-[15px] top-1.5 w-2 h-2 rounded-full border-2 transition-all ${
                                  st.done 
                                    ? 'bg-green-500 border-green-500 scale-110 shadow-sm shadow-green-500/30' 
                                    : st.active 
                                      ? 'bg-blue-600 border-blue-600 scale-125 animate-pulse shadow-sm shadow-blue-600/30' 
                                      : 'bg-white border-border-subtle'
                                }`} />
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-bold ${
                                    st.done 
                                      ? 'text-text-secondary line-through opacity-85' 
                                      : st.active 
                                        ? 'text-blue-600' 
                                        : 'text-text-muted'
                                  }`}>
                                    {st.label}
                                  </p>
                                  {st.active && (
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full animate-pulse uppercase font-sans">
                                      Active
                                    </span>
                                  )}
                                  {st.done && (
                                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full uppercase font-sans">
                                      Done
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[10px] leading-relaxed ${st.active ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
                                  {st.desc}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {selectedReq.completionChecklist && (
                        <div className="pt-3 border-t border-border-subtle/50">
                          <p className="text-[10px] font-bold text-text-muted uppercase">Completed Checklist</p>
                          <div className="flex justify-between text-xs mt-1.5">
                            <span className="text-text-muted">Bill Collected:</span>
                            <span className="font-semibold text-text-primary">{selectedReq.completionChecklist.billCollected ? 'Yes' : 'No'}</span>
                          </div>
                          {selectedReq.completionChecklist.billPhotoUrl && (
                            <div className="mt-2">
                              <a href={selectedReq.completionChecklist.billPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline font-semibold block">
                                View Bill Document &rarr;
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Administrative Log & Notes (Full Access like Admin) */}
                  <div className="pt-2 border-t border-border-subtle/50">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Representative Tracking Log</h4>
                    
                    {selectedReq.trackerEntry ? (
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-3 flex flex-col gap-1">
                        <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Icon icon={Note01Icon} size={10} /> Active Log Note
                        </p>
                        <p className="text-xs text-text-primary font-medium mt-0.5">{selectedReq.trackerEntry.notes}</p>
                        <p className="text-[9px] text-text-muted mt-1">Last synced: {formatDateTimeIST(selectedReq.trackerEntry.updatedAt)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted italic mb-3">No active log entries recorded for this operation.</p>
                    )}

                    {['InProgress', 'Completed', 'PaymentReceived'].includes(selectedReq.status) ? (
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!trackerNotes.trim()) return;
                          setIsUpdatingTracker(true);
                          try {
                            await app.updateTracker(selectedReq.id, trackerNotes, user);
                            toast('Operation log note synced successfully!');
                            setTrackerNotes('');
                          } catch (e) {
                            toast(e instanceof Error ? e.message : 'Action failed');
                          } finally {
                            setIsUpdatingTracker(false);
                          }
                        }} 
                        className="flex flex-col gap-2"
                      >
                        <textarea
                          value={trackerNotes}
                          onChange={e => setTrackerNotes(e.target.value)}
                          placeholder="Add representative tracker updates or flight notes..."
                          className="w-full p-2.5 rounded-xl border border-border-subtle bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isUpdatingTracker}
                          className="h-8 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors cursor-pointer border-0 disabled:opacity-50"
                        >
                          {isUpdatingTracker ? 'Syncing...' : 'Add Operation Log Note'}
                        </button>
                      </form>
                    ) : (
                      <p className="text-[10px] text-text-muted">
                        Log notes can be entered once spraying commences or is completed.
                      </p>
                    )}
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={() => setSelectedReq(null)} 
                    className="h-10 mt-2 rounded-xl border border-border-subtle bg-white text-text-secondary text-sm font-semibold hover:bg-surface-overlay transition-colors cursor-pointer border-0"
                  >
                    Close Panel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitApproval} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2 animate-fade-in">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle cursor-pointer hover:bg-green-50 transition-colors">
                      <input type="radio" name="approvalAction" checked={isApproved} onChange={() => setIsApproved(true)} className="w-4 h-4 text-green-600 animate-duration-300" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">Approve Request</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Allow the pilot to proceed with spraying.</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle cursor-pointer hover:bg-red-50 transition-colors">
                      <input type="radio" name="approvalAction" checked={!isApproved} onChange={() => setIsApproved(false)} className="w-4 h-4 text-red-600 animate-duration-300" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">Reject Request</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Halt the operation. Requires a reason.</p>
                      </div>
                    </label>
                  </div>

                  {!isApproved && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-semibold text-text-primary mb-1">Rejection Reason *</label>
                      <textarea 
                        value={rejectionReason} 
                        onChange={e => setRejectionReason(e.target.value)}
                        className="w-full p-3 rounded-xl border border-border-subtle bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none h-24"
                        placeholder="Please explain why this request is being rejected..."
                        required
                      />
                    </div>
                  )}

                  {err && <p className="text-sm text-red-500 font-medium px-1">{err}</p>}

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setSelectedReq(null)} className="flex-1 h-11 rounded-xl border border-border-subtle bg-white text-text-secondary text-sm font-semibold hover:bg-surface-overlay transition-colors cursor-pointer border-0">
                      Cancel
                    </button>
                    <button type="submit" className={`flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer border-0 shadow-sm ${isApproved ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}>
                      Confirm
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-surface-overlay border border-dashed border-border-subtle rounded-2xl p-8 flex flex-col items-center justify-center text-center sticky top-24 h-64">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                <Icon icon={Task01Icon} size={24} className="text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-secondary">Select a request to review</p>
              <p className="text-xs text-text-muted mt-1">Choose a pending request from the list to approve or track operations.</p>
            </div>
          )}
        </div>
      </div>

      {isSimulatingCall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-gray-900 border border-gray-800 text-white rounded-3xl p-6 w-80 flex flex-col items-center justify-center gap-5 shadow-2xl animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-xl font-bold animate-bounce shadow-lg shadow-green-500/30">
              {app.appData.users.find(u => u.id === selectedReq?.assignment?.pilotId)?.name.charAt(0) || 'P'}
            </div>
            <div className="text-center font-sans">
              <p className="text-lg font-bold">Calling Pilot...</p>
              <p className="text-sm text-gray-400 mt-1">
                {app.appData.users.find(u => u.id === selectedReq?.assignment?.pilotId)?.name || 'Spraying Pilot'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {app.appData.users.find(u => u.id === selectedReq?.assignment?.pilotId)?.phone}
              </p>
            </div>
            <div className="w-full flex justify-center mt-2">
              <button
                type="button"
                onClick={() => setIsSimulatingCall(false)}
                className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center cursor-pointer border-0 transition-colors"
              >
                <Icon icon={CancelCircleIcon} size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
