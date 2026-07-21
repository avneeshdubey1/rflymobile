const userRepository = require('../src/repositories/userRepository');
const { issueToken } = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../services/passwordService');
const admin = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');

const publicRole = (role) => String(role || '').toLowerCase().replaceAll('_', '-');

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

const businessResponse = (user, token) => ({
  success: true,
  token,
  user: {
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: publicRole(user.role),
    name: user.name,
    businessName: user.businessName,
    gstNo: user.gstNo,
    contactPerson: user.contactPerson,
    address: user.address,
  },
});

exports.registerBusiness = async (req, res) => {
  try {
    const { businessName, contactPerson, email, mobile, address, gstNo, password } = req.body;
    
    if (!businessName || !contactPerson || !email || !mobile || !address || !gstNo || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let existingUser = await userRepository.findByEmail(email);
    if (!existingUser) {
        existingUser = await userRepository.findByPhone(mobile);
    }
    
    if (existingUser) {
      return res.status(409).json({ error: 'A user is already registered with this email or mobile' });
    }

    const user = await userRepository.create({
      name: contactPerson,
      businessName,
      contactPerson,
      email,
      phone: mobile,
      address,
      gstNo,
      role: 'BUSINESS',
      active: false,
      passwordHash: await hashPassword(password),
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Business registered successfully. Pending activation.' 
    });
  } catch (error) {
    console.error('Business register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

exports.businessLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const identifier = String(email).trim().toLowerCase();
    const user = await userRepository.findByEmailForAuthentication(identifier);
    
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.role !== 'BUSINESS') {
        return res.status(403).json({ error: 'Access denied: not a business account' });
    }
    if (user.active === false) {
        return res.status(403).json({ error: 'This account is inactive' });
    }

    const token = issueToken(user);
    return res.json(businessResponse(user, token));
  } catch (error) {
    console.error('Business login error:', error);
    return res.status(error.status || 401).json({ error: error.status ? error.message : 'Login failed' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { idToken, newPassword } = req.body;
    
    if (!idToken || !newPassword) {
      return res.status(400).json({ error: 'Firebase ID token and new password are required' });
    }

    const phone = await verifiedFirebasePhone(idToken);
    
    const user = await userRepository.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'No business account found for this verified phone number' });
    }
    
    if (user.role !== 'BUSINESS') {
      return res.status(403).json({ error: 'Access denied: not a business account' });
    }

    const newPasswordHash = await hashPassword(newPassword);
    
    await userRepository.update(user.id, {
      passwordHash: newPasswordHash
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Business reset password error:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Password reset failed' });
  }
};
