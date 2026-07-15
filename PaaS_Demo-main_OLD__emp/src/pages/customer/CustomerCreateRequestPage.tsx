import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeafIcon, Calendar01Icon, Note01Icon, DropletIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

export function CustomerCreateRequestPage({ user, app }: Props) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const dbTimeSlots = app.appData?.timeSlots?.filter(t => t.isActive).map(t => t.slot) ?? [];
  const costConfig = app.appData?.configs?.find(c => c.key === 'cost_per_acre');
  const defaultCost = costConfig ? parseFloat(costConfig.value) : 500;

  const [formData, setFormData] = useState({
    cropType: '',
    fieldAreaAcres: '',
    requestedDate: '',
    requestedTimeSlot: '',
    chemical: '',
    notes: '',
  });

  useEffect(() => {
    if (dbTimeSlots.length > 0 && !formData.requestedTimeSlot) {
      setFormData(prev => ({ ...prev, requestedTimeSlot: dbTimeSlots[0] }));
    }
  }, [app.appData, dbTimeSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.customerId) {
      toast('Your account is not linked to a customer profile.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await app.createRequest({
        customerId: user.customerId,
        customerType: user.role === 'BB' ? 'BB' : 'BC',
        sourceOfRequest: 'Phone', // default for portal
        cropType: formData.cropType,
        fieldAreaAcres: Number(formData.fieldAreaAcres),
        requestedDate: formData.requestedDate,
        requestedTimeSlot: formData.requestedTimeSlot || dbTimeSlots[0] || 'Morning (6 AM - 10 AM)',
        chemical: formData.chemical,
        amountPerAcre: defaultCost, // Loaded dynamically from DB configuration!
        notes: formData.notes,
      }, user);
      toast('Request created successfully!', 'success');
      navigate('/dashboard');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to create request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0">
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border-subtle p-6 md:p-8 shadow-sm">
        <SectionHeader title="Raise Service Request" description="Submit a new drone spraying request." />

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 relative">
              <label className="text-sm font-semibold text-text-primary">Crop Type</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-text-muted"><Icon icon={LeafIcon} size={18} /></div>
                <input required type="text" value={formData.cropType} onChange={e => setFormData({ ...formData, cropType: e.target.value })} placeholder="e.g. Paddy, Cotton" className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-text-muted" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-primary">Field Area (Acres)</label>
              <div className="relative flex items-center">
                <input required type="number" step="0.1" min="0.1" value={formData.fieldAreaAcres} onChange={e => setFormData({ ...formData, fieldAreaAcres: e.target.value })} placeholder="0.0" className="w-full h-11 px-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-text-muted" />
                <span className="absolute right-4 text-sm text-text-muted pointer-events-none">acres</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-primary">Requested Date</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-text-muted"><Icon icon={Calendar01Icon} size={18} /></div>
                <input required type="date" value={formData.requestedDate} onChange={e => setFormData({ ...formData, requestedDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-primary">Time Slot</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-text-muted"><Icon icon={Calendar01Icon} size={18} /></div>
                <select value={formData.requestedTimeSlot} onChange={e => setFormData({ ...formData, requestedTimeSlot: e.target.value })} className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all appearance-none">
                  {dbTimeSlots.length > 0 ? (
                    dbTimeSlots.map(s => <option key={s} value={s}>{s}</option>)
                  ) : (
                    <>
                      <option>Morning (6 AM - 10 AM)</option>
                      <option>Afternoon (3 PM - 6 PM)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-text-primary">Chemical / Spray Material</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-text-muted"><Icon icon={DropletIcon} size={18} /></div>
                <input type="text" value={formData.chemical} onChange={e => setFormData({ ...formData, chemical: e.target.value })} placeholder="e.g. Urea, Pesticide name (optional)" className="w-full h-11 pl-10 pr-4 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-text-muted" />
              </div>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-text-primary">Additional Notes</label>
              <div className="relative">
                <div className="absolute left-3 top-3 text-text-muted"><Icon icon={Note01Icon} size={18} /></div>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any specific instructions for the pilot..." rows={3} className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-subtle bg-surface-overlay text-sm text-text-primary focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-text-muted resize-none" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl border border-border-subtle bg-white text-sm font-semibold text-text-secondary hover:bg-surface-overlay transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl border-0 bg-green-500 text-sm font-bold text-white hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center gap-2">
              {submitting ? 'Creating...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
