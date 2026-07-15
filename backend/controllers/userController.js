const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const { hashPassword, validatePassword } = require('../services/passwordService');
const roles = new Set(['ADMIN', 'SALES', 'FLEET_MANAGER', 'PILOT']);

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase().replaceAll('-', '_');
}

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('A valid work email is required');
  return normalized;
}

exports.getAllUsers = async (_req, res) => { try { res.json({ success: true, users: await userRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch users' }); } };
exports.getPilots = async (_req, res) => { try { res.json({ success: true, pilots: await userRepository.findAll({ role: 'PILOT' }) }); } catch { res.status(500).json({ error: 'Failed to fetch pilots' }); } };
exports.addUser = async (req, res) => {
  try {
    const role = normalizeRole(req.body.role);
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 120 || !roles.has(role)) return res.status(400).json({ error: 'A name and valid role are required' });
    const email = normalizeEmail(req.body.email);
    validatePassword(req.body.password);
    const passwordHash = await hashPassword(req.body.password);
    const user = await userRepository.create({
      email,
      name,
      phone: req.body.phone ? String(req.body.phone).trim() : null,
      homeCenterId: req.body.homeCenterId || null,
      role,
      passwordHash,
    });
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'CREATED', actorId: req.auth.userId, afterState: user });
    res.status(201).json({ success: true, user });
  } catch (error) {
    const validationError = /required|between|valid/i.test(error.message || '');
    const message = error.code === 'P2002' ? 'That work email is already registered' : validationError ? error.message : 'Failed to add user';
    res.status(error.code === 'P2002' ? 409 : validationError ? 400 : 500).json({ error: message });
  }
};
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.auth.userId) return res.status(409).json({ error: 'You cannot delete your own account' });
    const user = await userRepository.delete(req.params.id);
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'DELETED', actorId: req.auth.userId, beforeState: user });
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === 'P2003' ? 409 : 404).json({ error: error.code === 'P2003' ? 'This user is linked to operational records and cannot be deleted' : 'User not found' });
  }
};
exports.editPassword = async (req, res) => {
  try {
    validatePassword(req.body.newPassword);
    const user = await userRepository.updatePasswordHash(req.body.id, await hashPassword(req.body.newPassword));
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'PASSWORD_CHANGED_BY_ADMIN', actorId: req.auth.userId, afterState: { credentialChanged: true } });
    res.json({ success: true, user });
  } catch (error) {
    const validationError = /between|required/i.test(error.message || '');
    res.status(validationError ? 400 : 404).json({ error: validationError ? error.message : 'User not found' });
  }
};
exports.toggleActive = async (_req, res) => res.status(501).json({ error: 'User activation is not in the approved schema' });
