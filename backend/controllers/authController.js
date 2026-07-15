const userRepository = require('../src/repositories/userRepository');
const { issueToken } = require('../middleware/auth');
const { hashPassword, needsRehash, verifyPassword } = require('../services/passwordService');

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
