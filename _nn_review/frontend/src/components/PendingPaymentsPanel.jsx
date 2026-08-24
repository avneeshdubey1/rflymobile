import { useCallback, useEffect, useState } from 'react';
import OpsIcon from './OpsIcon';
import { API_URL as API } from '../config';

function PendingPaymentsPanel() {
  const [payments, setPayments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const request = useCallback(async (path, options) => {
    const response = await fetch(`${API}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Payment request failed');
    return data;
  }, []);

  const loadPayments = useCallback(async () => {
    try { const data = await request('/api/payments/pending'); setPayments(data.payments || []); }
    catch (error) { setNotice({ kind: 'error', message: error.message }); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadPayments(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadPayments]);

  const markCash = async (payment) => {
    try {
      await request(`/api/payments/${payment.id}/mark-cash`, { method: 'POST' });
      setNotice({ kind: 'success', message: `Cash collection recorded for ${payment.lead.farmerName}.` });
      await loadPayments();
    } catch (error) { setNotice({ kind: 'error', message: error.message }); }
  };

  const generateLink = async (payment) => {
    try {
      const result = await request(`/api/payments/${payment.assignmentId}/generate-link`, { method: 'POST' });
      setNotice({ kind: result.fallback ? 'error' : 'success', message: result.fallback ? 'No UPI provider is configured, so this remains in manual cash collection.' : 'UPI link generated and sent to the farmer.' });
      await loadPayments();
    } catch (error) { setNotice({ kind: 'error', message: error.message }); }
  };

  return (
    <section className="panel panel--raised">
      <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="wallet" /></span><h2>Pending manual collection</h2></div><p>Completed missions remain visible until settlement is recorded.</p></div><button type="button" className="action-btn" onClick={() => void loadPayments()}><OpsIcon name="refresh" /> Refresh</button></div>
      <div className="panel-body">
        {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
        {loading && <div className="empty-state"><strong>Loading pending payments…</strong><span>Checking completed missions and payment status.</span></div>}
        {!loading && !payments.length && <div className="empty-state"><strong>No payment follow-ups</strong><span>Every completed mission is currently settled.</span></div>}
      </div>
      {!loading && payments.length > 0 && <div className="data-stack">{payments.map((payment) => <article className="payment-row" key={payment.id}><div><strong>{payment.lead.farmerName}</strong><p className="caption">{payment.lead.farmerPhone} · {payment.assignment.actualAcreage || payment.assignment.expectedAcreage} acres</p><p className="payment-amount">{payment.amount > 0 ? `₹${payment.amount.toFixed(2)}` : 'Amount needs configuration'} · {payment.method === 'UPI' ? 'UPI pending' : 'Manual cash collection'}</p></div><div className="button-row">{!payment.upiLink && <button type="button" className="action-btn" onClick={() => void generateLink(payment)}>Try UPI link</button>}<button type="button" className="submit-btn" onClick={() => void markCash(payment)}>Mark cash collected</button></div></article>)}</div>}
    </section>
  );
}

export default PendingPaymentsPanel;
