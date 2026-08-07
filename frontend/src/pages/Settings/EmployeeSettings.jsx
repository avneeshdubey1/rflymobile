import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../config';

export default function EmployeeSettings({ initialPreferences, user }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);

  const isFleetManager = user?.role === 'FLEET_MANAGER';
  const isAdminOrSales = user?.role === 'ADMIN' || user?.role === 'SALES';

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(preferences)
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Preferences saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save preferences.');
      }
    } catch (err) {
      toast.error('Network error while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={saveSettings} style={{ maxWidth: '600px', display: 'grid', gap: '1.25rem' }}>
      
      {isFleetManager && (
        <section className="input-group" style={{ padding: '1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Fleet Manager Settings</h3>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              name="autoAssignLeads" 
              checked={preferences.autoAssignLeads ?? false} 
              onChange={handleChange}
              style={{ width: 'auto' }}
            />
            Auto-assign Leads to Available Pilots
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              name="dailyReportEmail" 
              checked={preferences.dailyReportEmail ?? true} 
              onChange={handleChange}
              style={{ width: 'auto' }}
            />
            Receive Daily Summary Email
          </label>
        </section>
      )}

      {isAdminOrSales && (
        <section className="input-group" style={{ padding: '1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Workspace Preferences</h3>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              name="desktopNotifications" 
              checked={preferences.desktopNotifications ?? true} 
              onChange={handleChange}
              style={{ width: 'auto' }}
            />
            Enable Desktop Notifications for Incoming Requests
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              name="twoFactorAuth" 
              checked={preferences.twoFactorAuth ?? false} 
              onChange={handleChange}
              style={{ width: 'auto' }}
            />
            Require Two-Factor Authentication
          </label>
        </section>
      )}

      <div>
        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
