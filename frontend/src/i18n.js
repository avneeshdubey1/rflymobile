import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ta from './locales/ta.json';
import kn from './locales/kn.json';
import te from './locales/te.json';
import hi from './locales/hi.json';
import ml from './locales/ml.json';

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
];

i18n.use(initReactI18next).init({
  resources: { 
    en: { translation: en }, 
    ta: { translation: ta }, 
    kn: { translation: kn }, 
    te: { translation: te }, 
    hi: { translation: hi },
    ml: { translation: ml }
  },
  lng: localStorage.getItem('preferredLanguage') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
