const en = require('../src/locales/en.json');
const ta = require('../src/locales/ta.json');
const kn = require('../src/locales/kn.json');
const te = require('../src/locales/te.json');
const hi = require('../src/locales/hi.json');
const ml = require('../src/locales/ml.json');

const dictionaries = { en, ta, kn, te, hi, ml };
const languageLocales = { en: 'en-IN', ta: 'ta-IN', kn: 'kn-IN', te: 'te-IN', hi: 'hi-IN', ml: 'ml-IN' };

function isSupportedLanguage(languageCode) {
  return Object.hasOwn(dictionaries, languageCode);
}

function normalizeLanguage(languageCode = 'ta') {
  const normalized = String(languageCode || 'ta').toLowerCase();
  if (!isSupportedLanguage(normalized)) throw new Error('preferredLanguage must be one of en, ta, kn, te, hi, or ml');
  return normalized;
}

function resolve(templateKey, languageCode = 'ta', variables = {}) {
  const dictionary = dictionaries[isSupportedLanguage(languageCode) ? languageCode : 'en'];
  const template = dictionary[templateKey] || dictionaries.en[templateKey];
  if (!template) throw new Error(`Unknown message template: ${templateKey}`);
  return template.replace(/{{(\w+)}}/g, (_match, key) => String(variables[key] ?? ''));
}

module.exports = { resolve, normalizeLanguage, isSupportedLanguage, languageLocales };
