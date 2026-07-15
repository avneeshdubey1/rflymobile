import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ta from './locales/ta.json';
import kn from './locales/kn.json';
import te from './locales/te.json';
import hi from './locales/hi.json';

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
];

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ta: { translation: ta }, kn: { translation: kn }, te: { translation: te }, hi: { translation: hi } },
  lng: localStorage.getItem('field-operations-language') || 'ta',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
