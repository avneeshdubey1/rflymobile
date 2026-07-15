const test = require('node:test');
const assert = require('node:assert/strict');
const i18nService = require('../services/i18nService');

const languages = ['en', 'ta', 'kn', 'te', 'hi'];

test('all five supported languages resolve lifecycle templates and preserve variables', () => {
  for (const language of languages) {
    const text = i18nService.resolve('mission_completed', language, { actualAcreage: 3.5, invoiceNote: 'invoice-note' });
    assert.equal(i18nService.normalizeLanguage(language), language);
    assert.match(text, /3\.5/);
    assert.match(text, /invoice-note/);
    assert.equal(text.includes('{{'), false);
  }
});

test('unsupported language codes are rejected before a lead is stored', () => {
  assert.throws(() => i18nService.normalizeLanguage('ml'), /preferredLanguage/);
});
