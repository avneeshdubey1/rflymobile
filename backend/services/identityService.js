function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(value) {
  const normalized = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    const error = new Error('A valid email address is required');
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  let internationalDigits = digits;
  if (digits.length === 10) internationalDigits = `91${digits}`;
  if (internationalDigits.length < 8 || internationalDigits.length > 15) {
    const error = new Error('A valid mobile number is required');
    error.status = 400;
    throw error;
  }
  return `+${internationalDigits}`;
}

function phoneVariants(value) {
  const canonical = normalizePhone(value);
  const digits = canonical.slice(1);
  const variants = new Set([canonical, digits]);
  if (digits.startsWith('91') && digits.length === 12) variants.add(digits.slice(2));
  return [...variants];
}

module.exports = { normalizeEmail, normalizePhone, phoneVariants, validateEmail };
