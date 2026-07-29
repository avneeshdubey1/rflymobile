const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');
const { hashPassword, validatePassword } = require('../services/passwordService');
const { normalizePhone } = require('../services/identityService');
const { disconnectUserSockets } = require('../middleware/auth');
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
    const phone = req.body.phone ? normalizePhone(req.body.phone) : null;
    validatePassword(req.body.password);
    const passwordHash = await hashPassword(req.body.password);
    if (req.auth.role === 'FLEET_MANAGER' && role !== 'PILOT') {
      return res.status(403).json({ error: 'Fleet Managers can only add pilots' });
    }
    const homeCenterId = String(req.body.homeCenterId || '').trim() || null;
    if (role === 'PILOT' && !homeCenterId) {
      return res.status(400).json({ error: 'An active operating center is required for every pilot' });
    }
    if (homeCenterId) {
      const center = await operatingCenterRepository.findById(homeCenterId);
      if (!center || !center.active) {
        return res.status(400).json({ error: 'The selected operating center is not active' });
      }
    }
    const isActive = req.auth.role === 'ADMIN';

    const user = await userRepository.create({
      email,
      name,
      phone,
      homeCenterId,
      role,
      passwordHash,
      active: isActive,
      // Internal employee accounts are provisioned against a work address
      // that the approving Admin/Fleet Manager has already verified.
      emailVerifiedAt: new Date(),
    });
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'CREATED', actorId: req.auth.userId, afterState: user });
    res.status(201).json({ success: true, user });
  } catch (error) {
    const validationError = /required|between|valid/i.test(error.message || '');
    const message = error.code === 'P2002' ? 'That work email or mobile is already registered' : validationError ? error.message : 'Failed to add user';
    res.status(error.code === 'P2002' ? 409 : validationError ? 400 : 500).json({ error: message });
  }
};

exports.updatePilotOperatingCenter = async (req, res) => {
  try {
    const pilot = await userRepository.findById(req.params.id);
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' });
    if (pilot.role !== 'PILOT') return res.status(409).json({ error: 'Operating center assignment is available only for pilots' });

    const homeCenterId = String(req.body.homeCenterId || '').trim();
    if (!homeCenterId) return res.status(400).json({ error: 'An active operating center is required for every pilot' });
    const center = await operatingCenterRepository.findById(homeCenterId);
    if (!center || !center.active) return res.status(400).json({ error: 'The selected operating center is not active' });
    if (pilot.homeCenterId === homeCenterId) return res.json({ success: true, user: pilot, unchanged: true });

    const activeAssignments = await assignmentRepository.findActiveForPilot(pilot.id);
    if (activeAssignments.length) {
      return res.status(409).json({ error: 'A pilot with an active assignment cannot be moved to another operating center' });
    }

    const updated = await userRepository.update(pilot.id, { homeCenterId });
    await auditLogRepository.create({
      entityType: 'User',
      entityId: pilot.id,
      action: 'PILOT_OPERATING_CENTER_CHANGED',
      actorId: req.auth.userId,
      beforeState: { role: pilot.role, homeCenterId: pilot.homeCenterId },
      afterState: { role: updated.role, homeCenterId: updated.homeCenterId },
    });
    return res.json({ success: true, user: updated });
  } catch {
    return res.status(500).json({ error: 'Failed to update the pilot operating center' });
  }
};
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.auth.userId) return res.status(409).json({ error: 'You cannot delete your own account' });
    const user = await userRepository.delete(req.params.id);
    disconnectUserSockets(req.app.get('io'), user.id);
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'DELETED', actorId: req.auth.userId, beforeState: user });
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === 'P2003' ? 409 : 404).json({ error: error.code === 'P2003' ? 'This user is linked to operational records and cannot be deleted' : 'User not found' });
  }
};
exports.editPassword = async (req, res) => {
  try {
    validatePassword(req.body.newPassword);
    const user = await userRepository.resetPassword(req.body.id, await hashPassword(req.body.newPassword), 'PASSWORD_CHANGED_BY_ADMIN');
    disconnectUserSockets(req.app.get('io'), user.id);
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'PASSWORD_CHANGED_BY_ADMIN', actorId: req.auth.userId, afterState: { credentialChanged: true } });
    res.json({ success: true, user });
  } catch (error) {
    const validationError = /between|required/i.test(error.message || '');
    res.status(validationError ? 400 : 404).json({ error: validationError ? error.message : 'User not found' });
  }
};
exports.toggleActive = async (req, res) => {
  try {
    if (req.body.userId === req.auth.userId) return res.status(409).json({ error: 'You cannot deactivate your own account' });
    const user = await userRepository.findById(req.body.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updatedUser = await userRepository.setActive(user.id, !user.active);
    disconnectUserSockets(req.app.get('io'), user.id);
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'TOGGLE_ACTIVE', actorId: req.auth.userId, beforeState: user, afterState: updatedUser });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle user active status' });
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const user = await userRepository.getPreferences(req.auth.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, preferences: user.preferences });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const user = await userRepository.getPreferences(req.auth.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const updatedPreferences = {
      ...(typeof user.preferences === 'object' && user.preferences ? user.preferences : {}),
      ...req.body
    };

    const updatedUser = await userRepository.updatePreferences(user.id, updatedPreferences);
    
    await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'UPDATE_PREFERENCES', actorId: req.auth.userId, beforeState: user.preferences, afterState: updatedPreferences });
    res.json({ success: true, preferences: updatedUser.preferences });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};
