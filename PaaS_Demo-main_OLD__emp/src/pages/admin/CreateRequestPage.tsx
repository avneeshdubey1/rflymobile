import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusSignIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/Icon';
import { ErrorState } from '../../components/ui/StateViews';
import { SectionHeader } from '../../components/shared';
import { toast } from '../../components/ui/Toast';
import { createRequestSchema } from '../../lib/validations/request';
import { getCustomers } from '../../hooks/useDaasApp';
import type { UseDaasAppResult } from '../../hooks/useDaasApp';
import type { User, CreateRequestInput } from '../../types/domain';

interface Props { user: User; app: UseDaasAppResult; }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label} {error ? <span className="text-red-500">*</span> : null}</span>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

const inputCls = "w-full h-11 px-4 rounded-xl border border-border-subtle bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all";

export function CreateRequestPage({ user, app }: Props) {
  const customers = getCustomers(app.appData);
  const nav = useNavigate();
  const [submitErr, setSubmitErr] = useState('');

  const dbTimeSlots = app.appData?.timeSlots?.filter(t => t.isActive).map(t => t.slot) ?? [];
  const costConfig = app.appData?.configs?.find(c => c.key === 'cost_per_acre');
  const defaultCost = costConfig ? parseFloat(costConfig.value) : 650;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      customerId: customers[0]?.id ?? '', customerType: customers[0]?.type ?? 'BB',
      cropType: '', fieldAreaAcres: 1, requestedDate: new Date().toISOString().split('T')[0],
      requestedTimeSlot: dbTimeSlots[0] ?? '07:00-09:00', sourceOfRequest: 'Phone', amountPerAcre: defaultCost, notes: '', chemical: '',
    },
  });

  useEffect(() => {
    if (app.appData) {
      reset({
        customerId: customers[0]?.id ?? '', customerType: customers[0]?.type ?? 'BB',
        cropType: '', fieldAreaAcres: 1, requestedDate: new Date().toISOString().split('T')[0],
        requestedTimeSlot: dbTimeSlots[0] ?? '07:00-09:00', sourceOfRequest: 'Phone', amountPerAcre: defaultCost, notes: '', chemical: '',
      });
    }
  }, [app.appData, reset]);

  if (user.role !== 'Admin') return <ErrorState title="Access denied" description="Only Admin/DSP can create requests." onRetry={() => nav('/dashboard')} />;

  const onSubmit = async (values: CreateRequestInput) => {
    try {
      setSubmitErr('');
      const cust = customers.find(c => c.id === values.customerId);
      await app.createRequest({ ...values, customerType: cust?.type ?? values.customerType }, user);
      toast('Request created successfully');
      nav('/requests');
    } catch (e) { setSubmitErr(e instanceof Error ? e.message : 'Unable to create request'); }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center hover:bg-surface-overlay transition-colors cursor-pointer" type="button">
          <Icon icon={ArrowLeft01Icon} size={16} />
        </button>
        <SectionHeader title="Create Request" description="Capture service requirements and scheduling details." />
      </div>

      <form className="flex flex-col gap-5 animate-slide-up" onSubmit={e => void handleSubmit(onSubmit)(e)}>
        {/* Customer & Crop */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Customer & Crop Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer" error={errors.customerId?.message}>
              <select className={inputCls} {...register('customerId')}>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
            </Field>
            <Field label="Crop Type" error={errors.cropType?.message}>
              <input className={inputCls} placeholder="e.g. Cotton, Paddy" {...register('cropType')} />
            </Field>
            <Field label="Field Area (Acres)" error={errors.fieldAreaAcres?.message}>
              <input className={inputCls} type="number" step="0.1" {...register('fieldAreaAcres', { valueAsNumber: true })} />
            </Field>
            <Field label="Chemical" error={errors.chemical?.message}>
              <input className={inputCls} placeholder="Pesticide/chemical name" {...register('chemical')} />
            </Field>
          </div>
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Scheduling & Pricing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Requested Date" error={errors.requestedDate?.message}>
              <input className={inputCls} type="date" {...register('requestedDate')} />
            </Field>
            <Field label="Time Slot" error={errors.requestedTimeSlot?.message}>
              <select className={inputCls} {...register('requestedTimeSlot')}>
                {dbTimeSlots.length > 0 ? (
                  dbTimeSlots.map(s => <option key={s} value={s}>{s}</option>)
                ) : (
                  ['06:00-08:00','07:00-09:00','08:00-10:00','10:00-12:00','14:00-16:00','16:00-18:00'].map(s => <option key={s} value={s}>{s}</option>)
                )}
              </select>
            </Field>
            <Field label="Amount Per Acre (₹)" error={errors.amountPerAcre?.message}>
              <input className={inputCls} type="number" step="1" {...register('amountPerAcre', { valueAsNumber: true })} />
            </Field>
            <Field label="Source" error={errors.sourceOfRequest?.message}>
              <select className={inputCls} {...register('sourceOfRequest')}>
                {['Phone','WhatsApp','WalkIn','PartnerReferral','Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-border-subtle p-5">
          <Field label="Notes">
            <textarea className={`${inputCls} min-h-[80px] py-3 resize-y`} placeholder="Special instructions..." {...register('notes')} />
          </Field>
        </div>

        {submitErr && <p className="text-sm text-red-500 font-medium">{submitErr}</p>}

        <button className="w-full h-12 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 shadow-md shadow-green-200 transition-all flex items-center justify-center gap-2 cursor-pointer border-0 md:w-auto md:px-8 md:ml-auto" type="submit" disabled={isSubmitting}>
          <Icon icon={PlusSignIcon} size={16} /> {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
