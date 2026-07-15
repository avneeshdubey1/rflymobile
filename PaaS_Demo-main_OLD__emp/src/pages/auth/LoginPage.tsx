import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { ArrowRight01Icon, SmartPhone01Icon, UserIcon, Building04Icon, MapsLocation01Icon } from '@hugeicons/core-free-icons';

interface LoginPageProps {
  onSendOtp: (phone: string) => Promise<void>;
  onLogin: (phone: string, otp: string) => Promise<void>;
  onSignUp: (payload: { name: string; phone: string; role: 'BC' | 'BB'; businessName?: string; address?: string; region?: string }) => Promise<{ message: string }>;
}

export function LoginPage({ onSendOtp, onLogin, onSignUp }: LoginPageProps) {
  const [step, setStep] = useState<'phone' | 'otp' | 'signup'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Sign up state
  const [name, setName] = useState('');
  const [role, setRole] = useState<'BC' | 'BB'>('BC');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [region, setRegion] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number.');
      setSuccess(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await onSendOtp(phone);
      setStep('otp');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit OTP.');
      setSuccess(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await onLogin(phone, otp);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || name.length < 2) {
      setError('Please enter your name.');
      setSuccess(null);
      return;
    }
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number.');
      setSuccess(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await onSignUp({ name, phone, role, businessName, address, region });
      setSuccess(res.message || 'Account created successfully.');
      setStep('phone');
      setLoading(false);
      // Reset sign up fields
      setName('');
      setBusinessName('');
      setAddress('');
      setRegion('');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up.');
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4"
      style={{ backgroundImage: 'url(/images/bg-pattern.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center border border-green-100 shadow-sm">
            <Icon icon={UserIcon} size={32} className="text-green-600" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Welcome to PaaS Demo</h1>
          <p className="text-text-secondary mt-2">Enter your credentials to access the platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm text-center">
            {success}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Phone Number</label>
              <div className="relative">
                <Icon icon={SmartPhone01Icon} size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  className="w-full pl-10 pr-4 h-12 text-lg rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-70 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? 'Sending...' : 'Send OTP'}
              {!loading && <Icon icon={ArrowRight01Icon} size={20} />}
            </button>
            <div className="mt-4 text-center">
              <p className="text-sm text-text-secondary">
                New customer?{' '}
                <button
                  type="button"
                  onClick={() => { setStep('signup'); setError(null); setSuccess(null); }}
                  className="text-green-600 font-semibold hover:underline cursor-pointer"
                >
                  Sign Up
                </button>
              </p>
            </div>
          </form>
        ) : step === 'otp' ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Enter OTP</label>
              <input
                type="text"
                placeholder="123456"
                className="w-full h-12 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <p className="text-xs text-text-muted text-center mt-3">Demo OTP is always 123456</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-70 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
              {!loading && <Icon icon={ArrowRight01Icon} size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-center text-sm font-medium text-text-secondary hover:text-text-primary mt-2 cursor-pointer"
            >
              Back to phone number
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-sm font-medium border cursor-pointer ${role === 'BC' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-border-subtle text-text-secondary hover:bg-gray-50'}`}
                onClick={() => setRole('BC')}
              >
                Individual Farmer (B-C)
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl text-sm font-medium border cursor-pointer ${role === 'BB' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-border-subtle text-text-secondary hover:bg-gray-50'}`}
                onClick={() => setRole('BB')}
              >
                Business (B-B)
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Full Name *</label>
              <div className="relative">
                <Icon icon={UserIcon} size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Your Name"
                  className="w-full pl-10 pr-4 h-11 text-base rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Phone Number *</label>
              <div className="relative">
                <Icon icon={SmartPhone01Icon} size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  className="w-full pl-10 pr-4 h-11 text-base rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            {role === 'BB' && (
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Business Name</label>
                <div className="relative">
                  <Icon icon={Building04Icon} size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Company or Organization"
                    className="w-full pl-10 pr-4 h-11 text-base rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Region / Location (Optional)</label>
              <div className="relative">
                <Icon icon={MapsLocation01Icon} size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="e.g. Madurai"
                  className="w-full pl-10 pr-4 h-11 text-base rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">Address (Optional)</label>
              <input
                type="text"
                placeholder="Full Address"
                className="w-full px-4 h-11 text-base rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 rounded-xl bg-green-600 text-white font-semibold text-base shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-70 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Account'}
              {!loading && <Icon icon={ArrowRight01Icon} size={20} />}
            </button>
            <div className="mt-4 text-center">
              <p className="text-sm text-text-secondary">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(null); setSuccess(null); }}
                  className="text-green-600 font-semibold hover:underline cursor-pointer"
                >
                  Log In
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
