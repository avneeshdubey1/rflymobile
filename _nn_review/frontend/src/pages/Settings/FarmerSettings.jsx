import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function FarmerSettings({ initialPreferences }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);

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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(preferences)
      });
      
      const data = await res.json();
      if (data.success) {
        if (preferences.language) {
          localStorage.setItem('preferredLanguage', preferences.language);
          // Optional: Force reload to apply language strings globally if needed
          // window.location.reload();
        }
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
      <section className="input-group" style={{ padding: '1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}>
        <h3 style={{ marginBottom: '1rem' }}>Communication Preferences</h3>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="smsAlerts" 
            checked={preferences.smsAlerts ?? true} 
            onChange={handleChange}
            style={{ width: 'auto' }}
          />
          Receive SMS Alerts
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="whatsappAlerts" 
            checked={preferences.whatsappAlerts ?? false} 
            onChange={handleChange}
            style={{ width: 'auto' }}
          />
          Receive updates via WhatsApp
        </label>
        
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Preferred Language</span>
          <select name="language" value={preferences.language || 'ta'} onChange={handleChange} style={{ width: '100%', maxWidth: '300px' }}>
            <option value="ta">Tamil</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
      </section>

      <section className="input-group" style={{ padding: '1rem', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)' }}>
        <h3 style={{ marginBottom: '1rem' }}>Farm Details</h3>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Default Farm Area (Acres)</span>
          <input 
            type="number" 
            step="0.1"
            name="defaultFarmArea" 
            placeholder="e.g. 5.5" 
            value={preferences.defaultFarmArea || ''} 
            onChange={handleChange} 
            style={{ width: '100%', maxWidth: '300px' }}
          />
        </label>
      </section>

      <div>
        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
