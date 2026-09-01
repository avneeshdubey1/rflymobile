import { useCallback, useEffect, useState } from 'react';
import { API_URL as API } from '../config';
import OpsIcon from './OpsIcon';

function money(amount, currencyCode) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currencyCode} ${amount}`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(value);
}

export default function B2cCashCollectionsPanel() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/b2c-cash-collections?limit=100`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Cash collection reports could not be loaded');
      setCollections(data.collections || []);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="panel panel--raised">
      <div className="panel-header">
        <div className="panel-header__title">
          <div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="wallet" /></span><h2>B2C cash reports</h2></div>
          <p>Pilot-reported cash is pending reconciliation. It is not an approved invoice or final settlement.</p>
        </div>
        <button type="button" className="action-btn" onClick={() => void load()}><OpsIcon name="refresh" /> Refresh</button>
      </div>
      <div className="panel-body">
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        {loading && <div className="empty-state"><strong>Loading cash reports…</strong></div>}
        {!loading && !collections.length && <div className="empty-state"><strong>No B2C cash reported</strong><span>Completed B2C missions reported by Pilots will appear here.</span></div>}
        {!loading && collections.length > 0 && <div className="data-stack">
          {collections.map((collection) => <article className="payment-row" key={collection.id}>
            <div>
              <strong>{collection.assignment.farmerDisplayName}</strong>
              <p className="caption">Recorded by {collection.recordedBy.displayName} · {new Date(collection.recordedAt).toLocaleString()}</p>
              <p className="payment-amount">{money(collection.amount, collection.currencyCode)} · Cash</p>
            </div>
            <span className="status-badge status-badge--warning">{collection.reviewStatus.replaceAll('_', ' ')}</span>
          </article>)}
        </div>}
      </div>
    </section>
  );
}
