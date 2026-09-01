import { useEffect, useMemo, useState } from 'react';
import OpsIcon from './OpsIcon';

const maintenanceReasons = {
  DRONE: [
    ['BATTERY_NOT_CHARGED', 'Battery not charged'],
    ['PROPELLER_DAMAGED', 'Propeller damaged'],
    ['ELECTRICAL_ISSUE', 'Electrical issue'],
    ['OTHER', 'Other maintenance issue'],
  ],
  LMV: [
    ['VEHICLE_BREAKDOWN', 'Vehicle breakdown'],
    ['TYRE_ISSUE', 'Tyre damage'],
    ['ENGINE_ISSUE', 'Engine issue'],
    ['ELECTRICAL_ISSUE', 'Electrical issue'],
    ['OTHER', 'Other maintenance issue'],
  ],
};

const lifecycleReasons = {
  OUT_OF_SERVICE: ['Safety concern', 'Major repair required', 'Compliance hold'],
  AVAILABLE: ['Inspection completed', 'Repair verified', 'Cleared by Fleet'],
  RETIRED: ['End of service life', 'Beyond economical repair', 'Fleet replacement'],
};

const copy = {
  MAINTENANCE: ['Open maintenance work', 'The asset becomes unavailable immediately and the work remains in the maintenance queue.'],
  OUT_OF_SERVICE: ['Mark out of service', 'The asset remains preserved in fleet history and cannot be scheduled.'],
  AVAILABLE: ['Return to service', 'Confirm the inspection or repair evidence before making the asset schedulable.'],
  RETIRED: ['Retire asset', 'Retirement is permanent for scheduling, but the asset and its complete history are preserved.'],
};

export default function AssetLifecycleDialog({ target, busy = false, onClose, onSubmit }) {
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const options = useMemo(() => (
    target?.targetStatus === 'MAINTENANCE'
      ? maintenanceReasons[target.assetType] || []
      : (lifecycleReasons[target?.targetStatus] || []).map((label) => ['OTHER', label])
  ), [target]);

  useEffect(() => {
    setReasonCode('');
    setReason('');
    setError('');
  }, [target]);

  if (!target) return null;
  const [title, description] = copy[target.targetStatus] || ['Update asset', 'Record an accountable lifecycle decision.'];

  const submit = (event) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!reasonCode || trimmed.length < 3 || trimmed.length > 500) {
      setError('Choose a quick reason and enter a note of 3 to 500 characters.');
      return;
    }
    void onSubmit({ ...target, reasonCode, reason: trimmed });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card asset-lifecycle-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-lifecycle-title">
        <div className="modal-card__header">
          <div><p className="eyebrow">Fleet lifecycle</p><h2 id="asset-lifecycle-title">{title}</h2></div>
          <button type="button" className="icon-button" aria-label="Close asset dialog" disabled={busy} onClick={onClose}>×</button>
        </div>
        <div className="asset-lifecycle-dialog__asset">
          <span className="panel-title-icon"><OpsIcon name={target.assetType === 'DRONE' ? 'drone' : 'truck'} /></span>
          <div><strong>{target.label}</strong><span>{target.assetType === 'DRONE' ? 'Drone' : 'Light motor vehicle'}</span></div>
        </div>
        <p className="muted">{description}</p>
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        <form className="form-stack" onSubmit={submit}>
          <fieldset className="quick-reason-fieldset">
            <legend>Quick reason</legend>
            <div className="quick-reason-grid">
              {options.map(([code, label]) => (
                <button
                  key={`${code}-${label}`}
                  type="button"
                  className={reasonCode === code && reason === label ? 'is-active' : ''}
                  onClick={() => { setReasonCode(code); setReason(label); setError(''); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="input-group">
            <span>Accountable note</span>
            <textarea value={reason} minLength="3" maxLength="500" onChange={(event) => { setReason(event.target.value); if (!reasonCode) setReasonCode('OTHER'); }} placeholder="Add inspection details or a concise operational reason" required />
            <span className="field-hint">{reason.length}/500 · Do not include credentials, phone numbers, or exact GPS coordinates.</span>
          </label>
          <div className="button-row button-row--end">
            <button type="button" className="action-btn" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" className={target.targetStatus === 'AVAILABLE' ? 'submit-btn' : 'danger-btn'} disabled={busy}>{busy ? 'Saving…' : title}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
