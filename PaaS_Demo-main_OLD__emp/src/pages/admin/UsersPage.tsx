import { useState } from 'react';
import { ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Toast/Toast';
import { PlusSignIcon, Delete01Icon, PowerIcon, Alert02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User, UserRole } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

const roleColors: Record<UserRole, string> = {
  Admin: 'bg-red-50 text-red-700 border-red-200',
  Pilot: 'bg-blue-50 text-blue-700 border-blue-200',
  Ops: 'bg-amber-50 text-amber-700 border-amber-200',
  Finance: 'bg-purple-50 text-purple-700 border-purple-200',
  BC: 'bg-green-50 text-green-700 border-green-200',
  BB: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Representative: 'bg-blue-50 text-blue-700 border-blue-200',
};

export function UsersPage({ user, app }: Props) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ 
    name: '', phone: '', role: 'Pilot' as UserRole,
    address: '', region: '', billingCycleDays: 0
  });

  if (!app.appData) return null;
  if (user.role !== 'Admin') return <ErrorState title="Access denied" description="Only Admin can manage users." onRetry={() => void app.refresh()} />;

  const users = app.appData.users;
  const byRole = users.reduce<Record<string, number>>((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.phone.length < 10) return toast('Please enter valid name and 10-digit phone', 'error');
    
    setLoading(true);
    try {
      await app.createUser({
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        address: formData.address || undefined,
        region: formData.region || undefined,
        billingCycleDays: (formData.role === 'BB' && formData.billingCycleDays) ? Number(formData.billingCycleDays) : undefined,
      }, user);
      toast('User created successfully', 'success');
      setIsCreateModalOpen(false);
      setFormData({ name: '', phone: '', role: 'Pilot', address: '', region: '', billingCycleDays: 0 });
    } catch (err: any) {
      toast(err.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    try {
      await app.updateUserStatus(targetUser.id, !targetUser.isActive, user);
      toast(`User ${targetUser.isActive ? 'suspended' : 'activated'} successfully`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update user status', 'error');
    }
  };

  const handleDeleteUser = async (targetId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await app.deleteUser(targetId, user);
      toast('User deleted successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="User Management" description="Manage pilots, ops executives and finance users." />
        <button 
          onClick={() => setIsCreateModalOpen(true)} 
          className="shrink-0 h-10 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors cursor-pointer border-0 flex items-center gap-2 shadow-sm"
        >
          <Icon icon={PlusSignIcon} size={18} />
          Add User
        </button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 animate-fade-in">
        {(['Admin','Pilot','Ops','Finance', 'BC', 'BB', 'Representative'] as UserRole[]).map(r => (
          <div key={r} className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{byRole[r] || 0}</p>
            <span className={`inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${roleColors[r]}`}>{r}</span>
          </div>
        ))}
      </div>

      {/* User Table */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg overflow-hidden animate-slide-up">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Phone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-surface-overlay/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">{u.name.charAt(0)}</div>
                      <span className="font-medium text-text-primary whitespace-nowrap">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${roleColors[u.role]}`}>{u.role}</span></td>
                  <td className="px-5 py-3.5 text-text-secondary">{u.phone}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} /> {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1.5 rounded-lg border border-border-subtle bg-white text-xs font-semibold hover:bg-surface-overlay transition-colors cursor-pointer flex items-center gap-1.5 ${u.isActive ? 'text-amber-600 hover:bg-amber-50 border-amber-200' : 'text-green-600 hover:bg-green-50 border-green-200'}`}
                      >
                        <Icon icon={u.isActive ? Alert02Icon : PowerIcon} size={14} />
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 rounded-lg border border-border-subtle bg-white text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                      >
                        <Icon icon={Delete01Icon} size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-border-subtle">
          {users.map(u => (
            <div key={u.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-500 text-white flex items-center justify-center text-xs font-bold shrink-0">{u.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                    <p className="text-[11px] text-text-muted">{u.phone}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleColors[u.role]}`}>{u.role}</span>
              </div>
              <div className="flex items-center justify-between bg-surface-overlay/30 p-2 rounded-lg">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-500'}`} /> {u.isActive ? 'Active' : 'Suspended'}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleStatus(u)} className={`p-1.5 rounded-lg ${u.isActive ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    <Icon icon={u.isActive ? Alert02Icon : PowerIcon} size={16} />
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600">
                    <Icon icon={Delete01Icon} size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-base">
              <h2 className="text-lg font-bold text-text-primary">Create New User</h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-full hover:bg-surface-overlay text-text-muted transition-colors cursor-pointer"
              >
                <Icon icon={Cancel01Icon} size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Full Name</label>
                  <input 
                    className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-base text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ramesh Pilot" autoFocus 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Phone Number</label>
                  <input 
                    className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-base text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} placeholder="10-digit mobile number" maxLength={10} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Role</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all appearance-none">
                      <option value="Pilot">Pilot</option>
                      <option value="Ops">Operations</option>
                      <option value="Finance">Finance</option>
                      <option value="Admin">Admin</option>
                      <option value="Representative">Representative</option>
                      <option value="BC">Customer (B-C)</option>
                      <option value="BB">Customer (B-B)</option>
                    </select>
                </div>
                {(formData.role === 'BC' || formData.role === 'BB') && (
                  <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-border-subtle">
                    <p className="text-sm font-semibold text-text-primary">Customer Details</p>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Address</label>
                      <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Customer Address" className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Region</label>
                      <input type="text" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} placeholder="E.g., North, South" className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
                    </div>

                    {formData.role === 'BB' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Billing Cycle (Days)</label>
                        <input type="number" value={formData.billingCycleDays} onChange={e => setFormData({ ...formData, billingCycleDays: Number(e.target.value) })} placeholder="15" className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
                      </div>
                    )}
                  </div>
                )}
                <div className="pt-6 flex gap-3">
                  <button 
                    type="button" 
                    className="flex-1 h-11 rounded-xl border border-border-subtle bg-white text-sm font-semibold text-text-secondary hover:bg-surface-overlay transition-colors cursor-pointer" 
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 h-11 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2" 
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
