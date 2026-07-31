import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: '',
  homeCenterId: '',
  password: '',
  confirmPassword: '',
};

function EmployeeRegistration() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [centers, setCenters] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = useMemo(
    () => !form.confirmPassword || form.password === form.confirmPassword,
    [form.confirmPassword, form.password],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await apiFetch('/api/centers/all', { signal: controller.signal });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data.error || 'Operating centers could not be loaded.');
        setCenters((data.centers || []).filter((center) => center.active));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      }
    })();
    return () => controller.abort();
  }, []);

  const update = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'role' && value !== 'PILOT' ? { homeCenterId: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (form.role === 'PILOT' && !form.homeCenterId) {
      setError('Select an operating center for the pilot.');
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch('/api/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          homeCenterId: form.homeCenterId || null,
          password: form.password,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Employee registration failed.');
      setSuccess(`${data.user.name}'s employee account was created successfully.`);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError.message || 'Employee registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-container employee-registration">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">Employee portal</p>
          <h1>Manage drone operations efficiently.</h1>
          <p>Create approved employee accounts for Sales, Fleet and field operations.</p>
        </div>
        <p className="login-context__footer">Only an authenticated Administrator can provision an employee account.</p>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card employee-registration__card">
          <p className="eyebrow">Employee registration</p>
          <h2>Create employee account</h2>
          <p className="subtitle">Register role-scoped access for the operations platform.</p>

          {error && <div className="alert error" role="alert">{error}</div>}
          {success && <div className="notice" role="status">{success}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="employee-grid">
              <div className="input-group">
                <label htmlFor="employee-name">Full Name</label>
                <input id="employee-name" value={form.name} onChange={(event) => update('name', event.target.value)} required minLength={2} maxLength={120} disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="employee-email">Work Email</label>
                <input id="employee-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required autoComplete="off" disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="employee-phone">Mobile Number</label>
                <input id="employee-phone" type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98765 43210" required maxLength={20} disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="employee-role">Role</label>
                <select id="employee-role" value={form.role} onChange={(event) => update('role', event.target.value)} required disabled={busy}>
                  <option value="">Select role</option>
                  <option value="SALES">Sales Executive</option>
                  <option value="FLEET_MANAGER">Fleet Manager</option>
                  <option value="PILOT">Pilot</option>
                </select>
              </div>
              {form.role === 'PILOT' && (
                <div className="input-group employee-grid__wide">
                  <label htmlFor="employee-center">Operating Center</label>
                  <select id="employee-center" value={form.homeCenterId} onChange={(event) => update('homeCenterId', event.target.value)} required disabled={busy}>
                    <option value="">Select operating center</option>
                    {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label htmlFor="employee-password">Temporary Password</label>
                <div className="password-field">
                  <input id="employee-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="employee-confirm-password">Confirm Password</label>
                <div className="password-field">
                  <input id="employee-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} aria-invalid={!passwordsMatch} />
                  <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
                </div>
                {!passwordsMatch && <span className="field-error">Passwords do not match.</span>}
              </div>
            </div>
            <button className="submit-btn login-submit" disabled={busy || !passwordsMatch}>{busy ? 'Registering…' : 'Register Employee'}</button>
          </form>
          <button type="button" className="back-link" onClick={() => navigate('/admin')}>← Return to Admin workspace</button>
        </div>
      </section>
    </main>
  );
}

export default EmployeeRegistration;
