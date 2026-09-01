const droneRepository = require('../src/repositories/droneRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');
const validStatuses = new Set(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE']);
const lifecycleForStatus = {
    AVAILABLE: { status: 'AVAILABLE', operationalState: 'IN_SERVICE', availabilityState: 'AVAILABLE' },
    ASSIGNED: { status: 'ASSIGNED', operationalState: 'IN_SERVICE', availabilityState: 'ASSIGNED' },
    MAINTENANCE: { status: 'MAINTENANCE', operationalState: 'MAINTENANCE', availabilityState: 'UNAVAILABLE' },
    OUT_OF_SERVICE: { status: 'OUT_OF_SERVICE', operationalState: 'OUT_OF_SERVICE', availabilityState: 'UNAVAILABLE' },
};

function optionalText(value, maximum = 120) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const text = String(value).trim();
    if (text.length > maximum) throw new Error(`Drone text fields must not exceed ${maximum} characters`);
    return text;
}

function optionalPositiveNumber(value, field, { integer = false } = {}) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isInteger(number))) throw new Error(`${field} must be a positive ${integer ? 'whole ' : ''}number`);
    return number;
}

function optionalCertification(value) {
    if (value === undefined || value === null || value === '') return false;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', 'yes', '1', 'certified'].includes(normalized)) return true;
    if (['false', 'no', '0', 'not certified'].includes(normalized)) return false;
    throw new Error('Certified must be Yes or No');
}

function hasOwn(object, field) {
    return Object.prototype.hasOwnProperty.call(object, field);
}

function requiredText(value, field, maximum = 120) {
    const text = String(value || '').trim();
    if (!text) throw new Error(`${field} is required`);
    if (text.length > maximum) throw new Error(`${field} must not exceed ${maximum} characters`);
    return text;
}

async function requireActiveCenter(value) {
    const homeCenterId = requiredText(value, 'Home center', 120);
    const center = await operatingCenterRepository.findActiveById(homeCenterId);
    if (!center) {
        const error = new Error('Home center must reference an active operating center');
        error.statusCode = 400;
        throw error;
    }
    return center.id;
}

async function assertNoActiveAssignment(droneId) {
    const active = await assignmentRepository.findActiveForDrone(droneId);
    if (active.length) {
        const error = new Error('An assigned drone cannot change availability while active missions exist');
        error.statusCode = 409;
        throw error;
    }
}

exports.getActiveDrones = async(_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll({ status: 'AVAILABLE', archivedAt: null }) }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };
exports.getAllDrones = async(_req, res) => { try { res.json({ success: true, drones: await droneRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch drones' }); } };

exports.addDrone = async(req, res) => {
    try {
        const model = requiredText(req.body.model, 'Model');
        const serialNumber = requiredText(req.body.serialNumber, 'Serial number');
        const homeCenterId = await requireActiveCenter(req.body.homeCenterId);
        const type = optionalText(req.body.type || req.body.category, 60);
        const tankCapacity = optionalPositiveNumber(req.body.tankCapacity ?? req.body.tankCapacityLitres, 'Tank capacity');
        const batteryCapacity = optionalPositiveNumber(req.body.batteryCapacity ?? req.body.batteryCapacityMah, 'Battery capacity', { integer: true });
        const endurance = optionalPositiveNumber(req.body.endurance ?? req.body.enduranceMinutes, 'Endurance', { integer: true });
        const drone = await droneRepository.create({
            name: optionalText(req.body.name),
            type,
            category: type,
            model,
            serialNumber,
            uin: optionalText(req.body.uin),
            manufacturer: optionalText(req.body.manufacturer),
            location: optionalText(req.body.location),
            tankCapacity,
            tankCapacityLitres: tankCapacity,
            batteryCapacity,
            batteryCapacityMah: batteryCapacity,
            endurance,
            enduranceMinutes: endurance,
            certified: optionalCertification(req.body.certified),
            serviceType: optionalText(req.body.serviceType ?? req.body.service),
            homeCenterId,
            status: 'AVAILABLE',
        }, { actorId: req.auth.userId });
        await auditLogRepository.create({ entityType: 'Drone', entityId: drone.id, action: 'CREATED', actorId: req.auth.userId, afterState: drone });
        res.status(201).json({ success: true, drone });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Drone serial number or UIN already exists' });
        if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
        const status = error.statusCode || (/must|required/i.test(error.message || '') ? 400 : 500);
        res.status(status).json({ error: status === 500 ? 'Failed to add drone' : error.message });
    }
};

exports.updateDrone = async(req, res) => {
    try {
        const before = await droneRepository.findById(req.params.id);
        if (!before) return res.status(404).json({ error: 'Drone not found' });
        if (before.archivedAt) return res.status(409).json({ error: 'An archived drone cannot be updated' });
        if (!hasOwn(req.body, 'homeCenterId')) await requireActiveCenter(before.homeCenterId);
        const data = {};
        if (hasOwn(req.body, 'name')) data.name = optionalText(req.body.name);
        if (hasOwn(req.body, 'model')) {
            data.model = requiredText(req.body.model, 'Model');
        }
        if (hasOwn(req.body, 'serialNumber')) {
            data.serialNumber = requiredText(req.body.serialNumber, 'Serial number');
        }
        if (hasOwn(req.body, 'homeCenterId')) {
            data.homeCenterId = await requireActiveCenter(req.body.homeCenterId);
            if (data.homeCenterId !== before.homeCenterId) await assertNoActiveAssignment(before.id);
        }
        if (hasOwn(req.body, 'uin')) data.uin = optionalText(req.body.uin);
        if (hasOwn(req.body, 'type') || hasOwn(req.body, 'category')) {
            const type = optionalText(req.body.type ?? req.body.category, 60);
            data.type = type;
            data.category = type;
        }
        if (hasOwn(req.body, 'manufacturer')) data.manufacturer = optionalText(req.body.manufacturer);
        if (hasOwn(req.body, 'location')) data.location = optionalText(req.body.location);
        if (hasOwn(req.body, 'tankCapacity') || hasOwn(req.body, 'tankCapacityLitres')) {
            const value = optionalPositiveNumber(req.body.tankCapacity ?? req.body.tankCapacityLitres, 'Tank capacity');
            data.tankCapacity = value;
            data.tankCapacityLitres = value;
        }
        if (hasOwn(req.body, 'batteryCapacity') || hasOwn(req.body, 'batteryCapacityMah')) {
            const value = optionalPositiveNumber(req.body.batteryCapacity ?? req.body.batteryCapacityMah, 'Battery capacity', { integer: true });
            data.batteryCapacity = value;
            data.batteryCapacityMah = value;
        }
        if (hasOwn(req.body, 'endurance') || hasOwn(req.body, 'enduranceMinutes')) {
            const value = optionalPositiveNumber(req.body.endurance ?? req.body.enduranceMinutes, 'Endurance', { integer: true });
            data.endurance = value;
            data.enduranceMinutes = value;
        }
        if (hasOwn(req.body, 'certified')) data.certified = optionalCertification(req.body.certified);
        if (hasOwn(req.body, 'serviceType') || hasOwn(req.body, 'service')) data.serviceType = optionalText(req.body.serviceType ?? req.body.service);
        const drone = await droneRepository.update(req.params.id, data, {
            actorId: req.auth.userId,
            clearIncompatiblePreferences: data.homeCenterId && data.homeCenterId !== before.homeCenterId,
        });
        await auditLogRepository.create({ entityType: 'Drone', entityId: drone.id, action: 'UPDATED', actorId: req.auth.userId, beforeState: before, afterState: drone });
        res.json({ success: true, drone });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ error: 'Drone serial number or UIN already exists' });
        if (error.code === 'P2003') return res.status(400).json({ error: 'Home center not found' });
        if (error.code === 'P2025') return res.status(404).json({ error: 'Drone not found' });
        const status = error.statusCode || (/must|required/i.test(error.message || '') ? 400 : 500);
        res.status(status).json({ error: status === 500 ? 'Failed to update drone' : error.message });
    }
};

exports.deleteDrone = async(req, res) => {
    try {
        const reason = String(req.body?.reason || '').trim();
        if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A retirement reason of 3 to 500 characters is required' });
        const result = await droneRepository.retire(req.params.id, req.auth.userId, reason);
        if (!result) return res.status(404).json({ error: 'Drone not found' });
        return res.json({ success: true, retired: true, alreadyRetired: !result.changed, drone: result.drone });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Failed to retire drone' });
    }
};

exports.updateStatus = async(req, res) => {
    try {
        if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Invalid drone status' });
        const before = await droneRepository.findById(req.body.droneId);
        if (!before) return res.status(404).json({ error: 'Drone not found' });
        if (before.archivedAt) return res.status(409).json({ error: 'An archived drone cannot change status' });
        if (req.body.status === 'ASSIGNED' && before.status !== 'ASSIGNED') {
            return res.status(409).json({ error: 'ASSIGNED status is controlled by mission scheduling' });
        }
        if (before.status === 'ASSIGNED' && req.body.status !== 'ASSIGNED') await assertNoActiveAssignment(before.id);
        if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(req.body.status)) await assertNoActiveAssignment(before.id);
        const reason = String(req.body.reason || '').trim();
        if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A status-change reason of 3 to 500 characters is required' });
        const drone = await droneRepository.update(before.id, lifecycleForStatus[req.body.status], { actorId: req.auth.userId });
        await auditLogRepository.create({
            entityType: 'Drone',
            entityId: drone.id,
            action: 'STATUS_CHANGE',
            actorId: req.auth.userId,
            beforeState: before,
            afterState: drone,
            reason,
        });
        return res.json({ success: true, drone });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update drone status' });
    }
};
