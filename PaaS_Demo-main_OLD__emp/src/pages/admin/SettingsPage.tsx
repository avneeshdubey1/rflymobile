import { useState, useEffect } from 'react';
import { SectionHeader } from '../../components/shared';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Toast/Toast';
import { 
  UserIcon, 
  SmartPhone01Icon, 
  Logout01Icon, 
  Delete01Icon, 
  PlusSignIcon, 
  Calendar01Icon,
  CreditCardIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon
} from '@hugeicons/core-free-icons';
import type { User, TimeSlot } from '../../types/domain';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';

interface Props { 
  user: User;
  app: UseDaasAppResult;
  onLogout: () => void;
}

type TabType = 'profile' | 'slots' | 'presets';

export function SettingsPage({ user, app, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile settings state
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [profileLoading, setProfileLoading] = useState(false);

  // Time Slots state
  const [newSlot, setNewSlot] = useState('');
  const [slotLoading, setSlotLoading] = useState(false);

  // Metrics state
  const [costPerAcre, setCostPerAcre] = useState('650');
  const [cropPresets, setCropPresets] = useState('');
  const [chemicalPresets, setChemicalPresets] = useState('');
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Load metrics from appData
  useEffect(() => {
    if (app.appData?.configs) {
      const cost = app.appData.configs.find(c => c.key === 'cost_per_acre')?.value ?? '650';
      const crops = app.appData.configs.find(c => c.key === 'crop_presets')?.value;
      const chemicals = app.appData.configs.find(c => c.key === 'chemical_presets')?.value;

      setCostPerAcre(cost);
      if (crops) {
        try {
          const parsed = JSON.parse(crops);
          setCropPresets(Array.isArray(parsed) ? parsed.join(', ') : crops);
        } catch { setCropPresets(crops); }
      }
      if (chemicals) {
        try {
          const parsed = JSON.parse(chemicals);
          setChemicalPresets(Array.isArray(parsed) ? parsed.join(', ') : chemicals);
        } catch { setChemicalPresets(chemicals); }
      }
    }
  }, [app.appData]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await app.updateProfile({ name, phone }, user);
      toast('Profile updated successfully', 'success');
      await app.refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlot.trim()) return;
    setSlotLoading(true);
    try {
      await app.createTimeSlot(newSlot, user);
      toast('Time slot created successfully', 'success');
      setNewSlot('');
      await app.refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to create time slot', 'error');
    } finally {
      setSlotLoading(false);
    }
  };

  const handleToggleSlot = async (slotId: string, currentStatus: boolean) => {
    try {
      await app.toggleTimeSlot(slotId, !currentStatus, user);
      toast(`Time slot ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
      await app.refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this time slot?')) return;
    try {
      await app.deleteTimeSlot(slotId, user);
      toast('Time slot deleted successfully', 'success');
      await app.refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to delete time slot', 'error');
    }
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    setMetricsLoading(true);
    try {
      // 1. Save Cost
      await app.updateConfig('cost_per_acre', costPerAcre.trim(), user);

      // 2. Save Crops
      const cropsList = cropPresets.split(',').map(s => s.trim()).filter(Boolean);
      await app.updateConfig('crop_presets', JSON.stringify(cropsList), user);

      // 3. Save Chemicals
      const chemicalsList = chemicalPresets.split(',').map(s => s.trim()).filter(Boolean);
      await app.updateConfig('chemical_presets', JSON.stringify(chemicalsList), user);

      toast('System configurations updated successfully', 'success');
      await app.refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update configurations', 'error');
    } finally {
      setMetricsLoading(false);
    }
  };

  const isAdmin = user.role === 'Admin';
  const timeSlots = app.appData?.timeSlots ?? [];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <SectionHeader title="Settings & Profile" description="Manage your personal profile, booking settings, and system parameters." />

      {/* Tabs */}
      {isAdmin && (
        <div className="flex border-b border-border-subtle bg-white px-2 pt-2 rounded-2xl border">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile' 
                ? 'border-green-600 text-green-600' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Profile Info
          </button>
          <button 
            onClick={() => setActiveTab('slots')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'slots' 
                ? 'border-green-600 text-green-600' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Time Slots Booking
          </button>
          <button 
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'presets' 
                ? 'border-green-600 text-green-600' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Metrics & Preset Options
          </button>
        </div>
      )}

      {/* Profile Settings Tab */}
      {activeTab === 'profile' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-border-subtle p-5 md:p-6 animate-slide-up shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-text-primary">Personal Profile</h3>
                <p className="text-xs text-text-muted mt-0.5">Keep your account details up to date.</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                {user.name.charAt(0)}
              </div>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Full Name</label>
                  <div className="relative">
                    <Icon icon={UserIcon} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="text"
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Icon icon={SmartPhone01Icon} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="tel"
                      className="w-full pl-10 pr-4 h-11 rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
                      value={phone} 
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-2 flex justify-end">
                <button 
                  type="submit" 
                  disabled={profileLoading || (name === user.name && phone === user.phone)}
                  className="h-10 px-6 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border-0"
                >
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-border-subtle p-5 shadow-sm">
              <h3 className="text-sm font-bold text-text-primary mb-4">Notification Preferences</h3>
              <div className="flex flex-col gap-3">
                {['B-C Payment Alerts', 'B-B Approval Rejections', 'New Job Assignments'].map(pref => (
                  <label key={pref} className="flex items-center justify-between cursor-pointer py-1.5 border-b border-border-subtle last:border-0">
                    <span className="text-sm font-medium text-text-secondary">{pref}</span>
                    <div className="w-10 h-6 bg-green-500 rounded-full relative transition-colors shadow-inner">
                      <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm" />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border-subtle p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary mb-3">System Information</h3>
                <div className="flex flex-col gap-2 text-xs font-medium text-text-muted bg-surface-base p-3 rounded-xl border border-border-subtle">
                  <p className="flex justify-between"><span>User Role:</span> <span className="text-text-primary">{user.role}</span></p>
                  <p className="flex justify-between"><span>Platform Version:</span> <span className="text-text-primary">2.1.0 (Enterprise)</span></p>
                  <p className="flex justify-between"><span>System Status:</span> <span className="text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected</span></p>
                </div>
              </div>
              
              <button 
                onClick={onLogout}
                className="mt-6 w-full h-11 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Icon icon={Logout01Icon} size={18} />
                Logout from Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Slots Tab */}
      {activeTab === 'slots' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          {/* Add time slot */}
          <div className="bg-white rounded-2xl border border-border-subtle p-5 md:p-6 shadow-sm h-fit">
            <h3 className="text-sm font-bold text-text-primary mb-1">Create Time Slot</h3>
            <p className="text-xs text-text-muted mb-4">Define available booking hours for service requests.</p>
            
            <form onSubmit={handleCreateSlot} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1.5">Slot Label</label>
                <div className="relative">
                  <Icon icon={Calendar01Icon} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input 
                    type="text"
                    placeholder="e.g. 16:00-18:00"
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
                    value={newSlot}
                    onChange={e => setNewSlot(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={slotLoading || !newSlot.trim()}
                className="w-full h-11 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <Icon icon={PlusSignIcon} size={16} />
                {slotLoading ? 'Creating...' : 'Add Time Slot'}
              </button>
            </form>
          </div>

          {/* Time Slots List */}
          <div className="bg-white rounded-2xl border border-border-subtle p-5 md:p-6 shadow-sm md:col-span-2">
            <h3 className="text-sm font-bold text-text-primary mb-1">Database Time Slots</h3>
            <p className="text-xs text-text-muted mb-4">Time slots loaded dynamically. Inactive slots will not be visible on the booking forms.</p>

            <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-1">
              {timeSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-base rounded-xl border border-dashed border-border-subtle">
                  <p className="text-sm text-text-muted font-medium">No time slots found in database.</p>
                </div>
              ) : (
                timeSlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface-overlay hover:border-green-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${slot.isActive ? 'bg-green-50 text-green-600' : 'bg-surface-base text-text-muted'}`}>
                        <Icon icon={Calendar01Icon} size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{slot.slot}</p>
                        <p className="text-[10px] text-text-muted font-medium">Created: {new Date(slot.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Active Toggle */}
                      <button 
                        onClick={() => handleToggleSlot(slot.id, slot.isActive)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-0 ${
                          slot.isActive 
                            ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {slot.isActive ? 'Active' : 'Inactive'}
                      </button>

                      {/* Delete */}
                      <button 
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors border-0 cursor-pointer"
                        title="Delete slot"
                      >
                        <Icon icon={Delete01Icon} size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics & Presets Tab */}
      {activeTab === 'presets' && isAdmin && (
        <div className="bg-white rounded-2xl border border-border-subtle p-5 md:p-6 shadow-sm animate-slide-up">
          <h3 className="text-sm font-bold text-text-primary mb-1">System Metrics & Presets Configuration</h3>
          <p className="text-xs text-text-muted mb-6">Define global metrics and auto-complete dropdown lists stored in the database.</p>

          <form onSubmit={handleSaveMetrics} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cost Per Acre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Default Cost Per Acre (₹)</label>
                <div className="relative">
                  <Icon icon={CreditCardIcon} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input 
                    type="number"
                    className="w-full pl-10 pr-4 h-11 rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
                    value={costPerAcre}
                    onChange={e => setCostPerAcre(e.target.value)}
                    required
                    min={1}
                  />
                </div>
                <p className="text-[10px] text-text-muted">Auto-populates new service request pricing.</p>
              </div>

              {/* Crop Presets */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Crop Presets (Comma Separated)</label>
                <input 
                  type="text"
                  placeholder="e.g. Paddy, Cotton, Wheat, Maize"
                  className="w-full px-4 h-11 rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
                  value={cropPresets}
                  onChange={e => setCropPresets(e.target.value)}
                />
                <p className="text-[10px] text-text-muted">Dynamic crop autocomplete options in create request screen.</p>
              </div>
            </div>

            {/* Chemical Presets */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Chemical presets (Comma Separated)</label>
              <textarea 
                placeholder="e.g. Pesticide A, Urea, Fungicide, Liquid NPK"
                className="w-full px-4 py-3 min-h-[90px] rounded-xl border border-border-subtle bg-surface-base text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow resize-y"
                value={chemicalPresets}
                onChange={e => setChemicalPresets(e.target.value)}
              />
              <p className="text-[10px] text-text-muted">Dynamic chemical selection options in create request screen.</p>
            </div>

            <div className="pt-4 flex justify-end border-t border-border-subtle">
              <button 
                type="submit"
                disabled={metricsLoading}
                className="h-11 px-8 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors cursor-pointer border-0 flex items-center justify-center"
              >
                {metricsLoading ? 'Saving Metrics...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
