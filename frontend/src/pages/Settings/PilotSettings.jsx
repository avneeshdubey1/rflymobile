import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function PilotSettings({ initialPreferences }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
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
        <h3 style={{ marginBottom: '1rem' }}>Pilot Operations</h3>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="offlineMode" 
            checked={preferences.offlineMode ?? false} 
            onChange={handleChange}
            style={{ width: 'auto' }}
          />
          Enable Offline Mode (Pre-download maps)
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="autoAcceptMissions" 
            checked={preferences.autoAcceptMissions ?? false} 
            onChange={handleChange}
            style={{ width: 'auto' }}
          />
          Automatically Accept Assigned Missions
        </label>
        
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Battery Warning Threshold (%)</span>
          <input 
            type="number" 
            name="batteryWarning" 
            min="10" max="50"
            value={preferences.batteryWarning || 20} 
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
