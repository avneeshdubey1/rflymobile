import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from './firebase';

export function normalizeIndianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const nationalNumber = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }
  return `+91${nationalNumber}`;
}

export function clearPhoneRecaptcha() {
  if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
  window.recaptchaVerifier = null;
  const container = document.getElementById('recaptcha-container');
  if (container) container.replaceChildren();
}

export function getPhoneRecaptcha() {
  if (!auth) throw new Error('Firebase phone authentication is not configured.');
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }
  return window.recaptchaVerifier;
}

