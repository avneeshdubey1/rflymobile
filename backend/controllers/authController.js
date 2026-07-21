const userRepository = require('../src/repositories/userRepository');
const { issueToken } = require('../middleware/auth');
const { hashPassword, needsRehash, verifyPassword } = require('../services/passwordService');
const admin = require('../config/firebase');

const publicRole = (role) => String(role || '').toLowerCase().replaceAll('_', '-');
const { getAuth } = require('firebase-admin/auth');

async function verifiedFirebasePhone(idToken) {
  if (!idToken) {
    const error = new Error('Missing Firebase ID token');
    error.status = 400;
    throw error;
  }

  if (!admin.getApps().length) {
    const error = new Error('Phone authentication is not configured on the server');
    error.status = 503;
    throw error;
  }

  const decodedToken = await getAuth().verifyIdToken(idToken);
  if (!decodedToken.phone_number) {
    const error = new Error('The verified Firebase account has no phone number');
    error.status = 400;
    throw error;
  }
  return decodedToken.phone_number;
}

const farmerResponse = (user, token) => ({
  success: true,
  token,
  user: {
    id: user.id,
    phone: user.phone,
    role: publicRole(user.role),
    name: user.name,
    village: user.village,
    district: user.district,
  },
});

exports.login = async (req, res) => {
  try {
    const { email, employeeId, password } = req.body;
    const identifier = String(email || employeeId || '').trim().toLowerCase();
    const user = identifier ? await userRepository.findByEmailForAuthentication(identifier) : null;
    if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    if (needsRehash(user.passwordHash)) await userRepository.updatePasswordHash(user.id, await hashPassword(password));
    const token = issueToken(user);
    return res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role.toLowerCase().replace('_', '-'), name: user.name } });
  } catch (error) { return res.status(500).json({ error: 'Login failed' }); }
};

exports.farmerLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const phone = await verifiedFirebasePhone(idToken);

    const user = await userRepository.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'No Farmer account is registered for this phone number', code: 'FARMER_NOT_REGISTERED' });
    }
    if (user.role !== 'FARMER') return res.status(403).json({ error: 'Use the employee login for this account' });
    if (user.active === false) return res.status(403).json({ error: 'This account is inactive' });

    const token = issueToken(user);
    return res.json(farmerResponse(user, token));
  } catch (error) {
    console.error('Farmer login error:', error);
    return res.status(error.status || 401).json({ error: error.status ? error.message : 'Invalid or expired phone verification' });
  }
};

exports.completeFarmerSignup = async (req, res) => {
  try {
    const { idToken, name, village, district } = req.body;
    if (!idToken || !String(name || '').trim() || !String(village || '').trim() || !String(district || '').trim()) {
      return res.status(400).json({ error: 'Name, village and district are required' });
    }
    const phone = await verifiedFirebasePhone(idToken);

    let user = await userRepository.findByPhone(phone);
    if (user) return res.status(409).json({ error: 'A user is already registered with this phone number', code: 'PHONE_ALREADY_REGISTERED' });

    user = await userRepository.create({
      name: String(name).trim(),
      phone,
      village: String(village).trim(),
      district: String(district).trim(),
      role: 'FARMER',
      email: `${phone.replace('+', '')}@farmer.local`,
      passwordHash: await hashPassword(require('crypto').randomBytes(48).toString('base64url')),
      phoneVerifiedAt: new Date(),
    });

    const token = issueToken(user);
    return res.status(201).json(farmerResponse(user, token));
  } catch (error) {
    console.error('Farmer signup error:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Signup failed' });
  }
};
