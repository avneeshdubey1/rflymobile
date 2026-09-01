const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');
const droneRepository = require('../src/repositories/droneRepository');
const lmvRepository = require('../src/repositories/lmvRepository');
const { hashPassword, validatePassword } = require('../services/passwordService');
const { normalizePhone } = require('../services/identityService');
const { disconnectUserSockets } = require('../middleware/auth');
const { publishOperationsChange } = require('../services/operationsChangeService');
const roles = new Set(['ADMIN', 'SALES', 'FLEET_MANAGER', 'PILOT']);

function normalizeRole(role) {
    return String(role || '').trim().toUpperCase().replaceAll('-', '_');
}

function normalizeEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('A valid work email is required');
    return normalized;
}

function isEligiblePreferredDrone(drone, homeCenterId) {
    return Boolean(
        drone &&
        !drone.archivedAt &&
        drone.homeCenterId === homeCenterId &&
        ['AVAILABLE', 'ASSIGNED'].includes(drone.status) &&
        drone.operationalState === 'IN_SERVICE' &&
        ['AVAILABLE', 'ASSIGNED'].includes(drone.availabilityState)
    );
}

function isEligiblePreferredLmv(lmv, homeCenterId) {
    return Boolean(lmv && lmv.homeCenterId === homeCenterId && ['AVAILABLE', 'ASSIGNED'].includes(lmv.status)
        && lmv.operationalState === 'IN_SERVICE' && ['AVAILABLE', 'ASSIGNED'].includes(lmv.availabilityState));
}

exports.getAllUsers = async(_req, res) => { try { res.json({ success: true, users: await userRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch users' }); } };
exports.getPilots = async(_req, res) => { try { res.json({ success: true, pilots: await userRepository.findAll({ role: 'PILOT' }) }); } catch { res.status(500).json({ error: 'Failed to fetch pilots' }); } };
exports.addUser = async(req, res) => {
    try {
        const role = normalizeRole(req.body.role);
        const name = String(req.body.name || '').trim();
        if (name.length < 2 || name.length > 120 || !roles.has(role)) return res.status(400).json({ error: 'A name and valid role are required' });
        const email = normalizeEmail(req.body.email);
        if (role === 'ADMIN' && await userRepository.count({ role: 'ADMIN' }) > 0) {
            return res.status(409).json({ error: 'This installation already has its single Admin account' });
        }
        const phone = req.body.phone ? normalizePhone(req.body.phone) : null;
        const rawPassword = req.body.password;
        validatePassword(rawPassword);
        const passwordHash = await hashPassword(rawPassword);

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

        let pilotFields = {};
        if (role === 'PILOT') {
            const idProof = String(req.body.idProof || '').trim();
            const licenseId = String(req.body.licenseId || '').trim();
            const addressLine1 = String(req.body.addressLine1 || '').trim();
            const state = String(req.body.state || '').trim();
            const city = String(req.body.city || '').trim();
            const pincode = String(req.body.pincode || '').trim();

            if (!idProof || !licenseId || !addressLine1 || !state || !city || !/^[0-9]{6}$/.test(pincode)) {
                return res.status(400).json({ error: 'ID proof, license ID, address, state, city, and a valid 6-digit pincode are required for pilots' });
            }

            const assignedDroneId = String(req.body.assignedDroneId || '').trim() || null;
            if (assignedDroneId) {
                const assignedDrone = await droneRepository.findById(assignedDroneId);
                if (!isEligiblePreferredDrone(assignedDrone, homeCenterId)) {
                    return res.status(409).json({ error: 'The preferred drone must be operational at the Pilot operating center' });
                }
            }
            const assignedLmvId = String(req.body.assignedLmvId || '').trim() || null;
            if (assignedLmvId && !isEligiblePreferredLmv(await lmvRepository.findById(assignedLmvId), homeCenterId)) {
                return res.status(409).json({ error: 'The preferred vehicle must be operational at the Pilot operating center' });
            }

            pilotFields = {
                idProof,
                licenseId,
                addressLine1,
                addressLine2: String(req.body.addressLine2 || '').trim() || null,
                state,
                city,
                pincode,
                assignedDroneId,
                assignedLmvId,
            };
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
            ...pilotFields,
            // Internal employee accounts are provisioned against a work address
            // that the approving Admin/Fleet Manager has already verified.
            emailVerifiedAt: new Date(),
        });
        await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'CREATED', actorId: req.auth.userId, afterState: user });
        if (user.role === 'PILOT') publishOperationsChange(req, 'pilots');
        res.status(201).json({ success: true, user });
    } catch (error) {
        const validationError = /required|between|valid/i.test(error.message || '');
        const conflictMessage = 'That work email or mobile is already registered';
        const message = error.code === 'P2002' ? conflictMessage : validationError ? error.message : 'Failed to add user';
        res.status(error.code === 'P2002' ? 409 : validationError ? 400 : 500).json({ error: message });
    }
};

exports.updatePilotOperatingCenter = async(req, res) => {
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

        const updated = await userRepository.update(pilot.id, { homeCenterId, assignedDroneId: null, assignedLmvId: null });
        await auditLogRepository.create({
            entityType: 'User',
            entityId: pilot.id,
            action: 'PILOT_OPERATING_CENTER_CHANGED',
            actorId: req.auth.userId,
            beforeState: { role: pilot.role, homeCenterId: pilot.homeCenterId, assignedDroneId: pilot.assignedDroneId, assignedLmvId: pilot.assignedLmvId },
            afterState: { role: updated.role, homeCenterId: updated.homeCenterId, assignedDroneId: updated.assignedDroneId, assignedLmvId: updated.assignedLmvId },
        });
        publishOperationsChange(req, 'pilots');
        return res.json({ success: true, user: updated });
    } catch {
        return res.status(500).json({ error: 'Failed to update the pilot operating center' });
    }
};
exports.deleteUser = async(req, res) => {
    try {
        if (req.params.id === req.auth.userId) return res.status(409).json({ error: 'You cannot delete your own account' });
        const existing = await userRepository.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'User not found' });
        if (existing.role === 'ADMIN') return res.status(409).json({ error: 'The installation Admin account cannot be deleted' });
        const user = await userRepository.hardDelete(req.params.id);
        disconnectUserSockets(req.app.get('io'), user.id);
        await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'DELETED', actorId: req.auth.userId, beforeState: user });
        publishOperationsChange(req, 'pilots');
        res.json({ success: true });
    } catch (error) {
        res.status(error.code === 'P2003' ? 409 : 404).json({ error: error.code === 'P2003' ? 'This user is linked to operational records and cannot be deleted' : 'User not found' });
    }
};
exports.editPassword = async(req, res) => {
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
exports.toggleActive = async(req, res) => {
    try {
        if (req.body.userId === req.auth.userId) return res.status(409).json({ error: 'You cannot deactivate your own account' });
        const user = await userRepository.findById(req.body.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'ADMIN') return res.status(409).json({ error: 'The installation Admin account cannot be deactivated' });
        const updatedUser = await userRepository.setActive(user.id, !user.active);
        disconnectUserSockets(req.app.get('io'), user.id);
        await auditLogRepository.create({ entityType: 'User', entityId: user.id, action: 'TOGGLE_ACTIVE', actorId: req.auth.userId, beforeState: user, afterState: updatedUser });
        publishOperationsChange(req, 'pilots');
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle user active status' });
    }
};

exports.getPreferences = async(req, res) => {
    try {
        const user = await userRepository.getPreferences(req.auth.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, preferences: user.preferences });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
};

exports.updatePreferences = async(req, res) => {
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


// exports.updateUser = async(req, res) => {
//     try {
//         const existing = await userRepository.findById(req.params.id);
//         if (!existing) return res.status(404).json({ error: 'User not found' });

//         const updateData = {};
//         if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
//         if (req.body.email !== undefined) updateData.email = normalizeEmail(req.body.email);
//         if (req.body.phone !== undefined) updateData.phone = req.body.phone ? normalizePhone(req.body.phone) : null;
//         if (req.body.address !== undefined) updateData.address = String(req.body.address).trim() || null;
//         if (req.body.homeCenterId !== undefined) updateData.homeCenterId = req.body.homeCenterId || null;
//         if (req.body.idProof !== undefined) updateData.idProof = String(req.body.idProof).trim() || null;
//         if (req.body.licenseId !== undefined) updateData.licenseId = String(req.body.licenseId).trim() || null;
//         if (req.body.addressLine1 !== undefined) updateData.addressLine1 = String(req.body.addressLine1).trim() || null;
//         if (req.body.addressLine2 !== undefined) updateData.addressLine2 = String(req.body.addressLine2).trim() || null;
//         if (req.body.state !== undefined) updateData.state = String(req.body.state).trim() || null;
//         if (req.body.city !== undefined) updateData.city = String(req.body.city).trim() || null;
//         if (req.body.pincode !== undefined) updateData.pincode = String(req.body.pincode).trim() || null;
//         if (req.body.active !== undefined) updateData.active = Boolean(req.body.active);
//         if (req.body.assignedDroneId !== undefined) updateData.assignedDroneId = req.body.assignedDroneId || null;

//         const updated = await userRepository.update(existing.id, updateData);
//         await auditLogRepository.create({ entityType: 'User', entityId: updated.id, action: 'UPDATED', actorId: req.auth.userId, beforeState: existing, afterState: updated });
//         res.json({ success: true, user: updated });
//     } catch (error) {
//         const message = error.code === 'P2002' ? 'That work email or mobile is already registered' : 'Failed to update user';
//         res.status(error.code === 'P2002' ? 409 : 500).json({ error: message });
//     }
// };


exports.updateUser = async(req, res) => {
    try {
        const existing = await userRepository.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'User not found' });
        if (req.auth.role === 'FLEET_MANAGER' && existing.role !== 'PILOT') {
            return res.status(403).json({ error: 'Fleet Managers can update only Pilot profiles' });
        }
        if (req.body.active !== undefined) {
            return res.status(400).json({ error: 'Use the Admin activation control to change account status' });
        }

        const updateData = {};
        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();
            if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Name must contain between 2 and 120 characters' });
            updateData.name = name;
        }
        if (req.body.email !== undefined) updateData.email = normalizeEmail(req.body.email);
        if (req.body.phone !== undefined) updateData.phone = req.body.phone ? normalizePhone(req.body.phone) : null;
        if (req.body.address !== undefined) updateData.address = String(req.body.address).trim() || null;
        let homeCenterChanged = false;
        if (req.body.homeCenterId !== undefined) {
            const homeCenterId = String(req.body.homeCenterId || '').trim();
            if (existing.role === 'PILOT' && !homeCenterId) {
                return res.status(400).json({ error: 'An active operating center is required for every pilot' });
            }
            if (homeCenterId) {
                const center = await operatingCenterRepository.findById(homeCenterId);
                if (!center || !center.active) return res.status(400).json({ error: 'The selected operating center is not active' });
            }
            if (existing.role === 'PILOT' && homeCenterId !== existing.homeCenterId) {
                const activeAssignments = await assignmentRepository.findActiveForPilot(existing.id);
                if (activeAssignments.length) {
                    return res.status(409).json({ error: 'A pilot with an active assignment cannot be moved to another operating center' });
                }
                homeCenterChanged = true;
            }
            updateData.homeCenterId = homeCenterId || null;
        }
        if (req.body.idProof !== undefined) updateData.idProof = String(req.body.idProof).trim() || null;
        if (req.body.licenseId !== undefined) updateData.licenseId = String(req.body.licenseId).trim() || null;
        if (req.body.addressLine1 !== undefined) updateData.addressLine1 = String(req.body.addressLine1).trim() || null;
        if (req.body.addressLine2 !== undefined) updateData.addressLine2 = String(req.body.addressLine2).trim() || null;
        if (req.body.state !== undefined) updateData.state = String(req.body.state).trim() || null;
        if (req.body.city !== undefined) updateData.city = String(req.body.city).trim() || null;
        if (req.body.pincode !== undefined) updateData.pincode = String(req.body.pincode).trim() || null;
        if (req.body.assignedDroneId !== undefined) {
            if (existing.role !== 'PILOT') return res.status(400).json({ error: 'Only Pilots can have a preferred home drone' });
            const assignedDroneId = String(req.body.assignedDroneId || '').trim() || null;
            if (assignedDroneId) {
                const drone = await droneRepository.findById(assignedDroneId);
                const effectiveCenterId = updateData.homeCenterId || existing.homeCenterId;
                if (!isEligiblePreferredDrone(drone, effectiveCenterId)) {
                    if (homeCenterChanged && assignedDroneId === existing.assignedDroneId) {
                        updateData.assignedDroneId = null;
                    } else {
                        return res.status(409).json({ error: 'The preferred drone must be operational at the Pilot operating center' });
                    }
                } else {
                    updateData.assignedDroneId = assignedDroneId;
                }
            } else {
                updateData.assignedDroneId = null;
            }
        } else if (homeCenterChanged) {
            updateData.assignedDroneId = null;
        }
        if (req.body.assignedLmvId !== undefined) {
            if (existing.role !== 'PILOT') return res.status(400).json({ error: 'Only Pilots can have a preferred vehicle' });
            const assignedLmvId = String(req.body.assignedLmvId || '').trim() || null;
            const effectiveCenterId = updateData.homeCenterId || existing.homeCenterId;
            if (assignedLmvId === existing.assignedLmvId && !homeCenterChanged) {
                // Preserve an existing preference while the vehicle is temporarily unavailable.
            } else if (assignedLmvId && !isEligiblePreferredLmv(await lmvRepository.findById(assignedLmvId), effectiveCenterId)) {
                return res.status(409).json({ error: 'The preferred vehicle must be operational at the Pilot operating center' });
            } else {
                updateData.assignedLmvId = assignedLmvId;
            }
        } else if (homeCenterChanged) {
            updateData.assignedLmvId = null;
        }

        if (!Object.keys(updateData).length) return res.status(400).json({ error: 'At least one supported profile field is required' });

        const updated = await userRepository.update(existing.id, updateData);
        await auditLogRepository.create({ entityType: 'User', entityId: updated.id, action: 'UPDATED', actorId: req.auth.userId, beforeState: existing, afterState: updated });
        if (updated.role === 'PILOT') publishOperationsChange(req, 'pilots');
        res.json({ success: true, user: updated });
    } catch (error) {
        if (error.code === 'P2002') {
            const target = (error.meta && error.meta.target) || [];
            let message = 'A unique field conflict occurred.';
            if (target.includes('email')) message = 'That work email is already registered';
            else if (target.includes('phone')) message = 'That mobile number is already registered';
            return res.status(409).json({ error: message });
        }
        const validationError = /required|between|valid|only Pilots|operating center|activation control/i.test(error.message || '');
        res.status(validationError ? 400 : 500).json({ error: validationError ? error.message : 'Failed to update user' });
    }
};
