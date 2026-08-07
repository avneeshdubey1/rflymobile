import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import OperationsShell from '../../components/OperationsShell';
import FarmerSettings from './FarmerSettings';
import PilotSettings from './PilotSettings';
import EmployeeSettings from './EmployeeSettings';
import OpsIcon from '../../components/OpsIcon';
import LanguageSelector from '../../components/LanguageSelector';
import { API_URL } from '../../config';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/preferences`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
          setPreferences(data.preferences || {});
        }
      } catch (err) {
        console.error('Failed to load preferences', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  const navItems = [
    { id: 'settings', label: 'Preferences', icon: 'users' },
    { id: 'back', label: 'Back to Dashboard', icon: 'refresh' },
  ];

  const handleTabChange = (id) => {
    if (id === 'back') {
      // Determine dashboard based on role
      const role = user?.role?.toUpperCase();
      if (role === 'FARMER') navigate('/farmer/dashboard');
      else if (role === 'PILOT') navigate('/pilot');
      else if (role === 'FLEET_MANAGER') navigate('/fleet-manager');
      else if (role === 'ADMIN') navigate('/admin');
      else if (role === 'SALES') navigate('/marketing');
      else navigate('/');
    }
  };

  const roleLabel = "Settings";

  let SettingsComponent = EmployeeSettings;
  const normalizedRole = user?.role?.toUpperCase();
  if (normalizedRole === 'FARMER') SettingsComponent = FarmerSettings;
  else if (normalizedRole === 'PILOT') SettingsComponent = PilotSettings;

  return (
    <OperationsShell roleLabel={roleLabel} navItems={navItems} activeTab="settings" onTabChange={handleTabChange} user={user} logout={logout}>
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">PREFERENCES</p>
          <h1>Account Settings</h1>
          <p>Manage your account configurations and notifications.</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <LanguageSelector />
        </div>
      </header>
      
      {loading ? (
        <p>Loading settings...</p>
      ) : (
        <SettingsComponent initialPreferences={preferences} user={user} />
      )}
    </OperationsShell>
  );
}
