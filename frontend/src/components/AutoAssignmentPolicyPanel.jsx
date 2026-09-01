import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL as API } from '../config';
import { csrfHeaders } from '../utils/csrf';

const editableFields = [
  ['searchHorizonDays', 'number', 1, 14],
  ['workingDayStartMinutes', 'number', 0, 1439],
  ['workingDayEndMinutes', 'number', 1, 1440],
  ['defaultJobDurationMinutes', 'number', 15, 720],
  ['turnaroundMinutes', 'number', 0, 240],
  ['maxJobsPerUnitPerDay', 'number', 1, 20],
  ['maxAcreagePerUnitPerDay', 'number', 0.01, 999999],
];

function normalizePolicy(policy) {
  return {
    ...policy,
    maxJobsPerUnitPerDay: policy.maxJobsPerUnitPerDay ?? '',
    maxAcreagePerUnitPerDay: policy.maxAcreagePerUnitPerDay ?? '',
  };
}

export default function AutoAssignmentPolicyPanel({ editable = false, compact = false }) {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(null);
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`${API}/api/auto-assignment-policy`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || t('auto_policy_load_failed'));
    setPolicy(data.policy);
    setDraft(normalizePolicy(data.policy));
  }, [t]);

  useEffect(() => { void load().catch((error) => setNotice({ kind: 'error', message: error.message })); }, [load]);

  if (!draft) return <section className="panel panel--raised"><div className="panel-body">{notice?.message || t('auto_policy_loading')}</div></section>;

  const save = async (event) => {
    event.preventDefault();
    if (draft.enabled !== policy.enabled && !window.confirm(t(draft.enabled ? 'auto_policy_enable_confirm' : 'auto_policy_disable_confirm'))) return;
    setSaving(true);
    setNotice(null);
    const changes = {
      enabled: draft.enabled,
      searchHorizonDays: Number(draft.searchHorizonDays),
      workingDayStartMinutes: Number(draft.workingDayStartMinutes),
      workingDayEndMinutes: Number(draft.workingDayEndMinutes),
      defaultJobDurationMinutes: Number(draft.defaultJobDurationMinutes),
      turnaroundMinutes: Number(draft.turnaroundMinutes),
      maxJobsPerUnitPerDay: draft.maxJobsPerUnitPerDay === '' ? null : Number(draft.maxJobsPerUnitPerDay),
      maxAcreagePerUnitPerDay: draft.maxAcreagePerUnitPerDay === '' ? null : String(draft.maxAcreagePerUnitPerDay),
      weatherUnavailableAction: draft.weatherUnavailableAction,
    };
    try {
      const response = await fetch(`${API}/api/auto-assignment-policy`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ expectedRevision: policy.revision, ...changes }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        await load();
        throw new Error(t('auto_policy_revision_conflict'));
      }
      if (!response.ok) throw new Error(data.error || t('auto_policy_save_failed'));
      setPolicy(data.policy);
      setDraft(normalizePolicy(data.policy));
      setNotice({ kind: 'success', message: t('auto_policy_saved') });
    } catch (error) {
      setNotice({ kind: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !editable || compact;
  const controlsDisabled = readOnly || !draft.enabled;

  return <section className="panel panel--raised">
    <div className="panel-header"><div className="panel-header__title"><h2>{t('auto_policy_title')}</h2><p>{readOnly ? t('auto_policy_read_only') : t('auto_policy_future_only')}</p></div></div>
    <form className={`panel-body form-stack policy-preview ${controlsDisabled ? 'policy-preview--disabled' : ''}`} onSubmit={save}>
      {notice && <div role="alert" className={`notice notice--${notice.kind}`}>{notice.message}</div>}
      <div className="policy-preview__status"><span className={`status-badge status-badge--${draft.enabled ? 'success' : 'warning'}`}>{t(draft.enabled ? 'auto_policy_automatic' : 'auto_policy_paused')}</span>{!draft.enabled && <span>Configuration is preserved but automatic assignment is paused.</span>}</div>
      <label className="input-group"><span>{t('auto_policy_enabled')}</span><select disabled={readOnly} value={draft.enabled ? 'enabled' : 'paused'} onChange={(event) => setDraft({ ...draft, enabled: event.target.value === 'enabled' })}><option value="enabled">{t('auto_policy_automatic')}</option><option value="paused">{t('auto_policy_paused')}</option></select></label>
      <fieldset className="policy-fields" disabled={controlsDisabled}>
        {editableFields.map(([field, type, min, max]) => <label className="input-group" key={field}><span>{t(`auto_policy_${field}`)}</span><input type={type} min={min} max={max} step={field === 'maxAcreagePerUnitPerDay' ? '0.01' : '1'} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
        <label className="input-group"><span>{t('auto_policy_weatherUnavailableAction')}</span><select value={draft.weatherUnavailableAction} onChange={(event) => setDraft({ ...draft, weatherUnavailableAction: event.target.value })}><option value="SCHEDULE_WITH_WARNING">{t('auto_policy_weather_warning')}</option><option value="MANUAL_REVIEW">{t('auto_policy_weather_manual')}</option></select></label>
      </fieldset>
      <p>{t('auto_policy_revision', { revision: draft.revision })}</p>
      <p>{t('auto_policy_last_updated', { value: new Date(draft.updatedAt).toLocaleString() })}</p>
      {!readOnly && <button className="submit-btn" type="submit" disabled={saving}>{saving ? t('auto_policy_saving') : t('auto_policy_save')}</button>}
    </form>
  </section>;
}
