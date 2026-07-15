const crypto = require('crypto');

let generatedDevelopmentSecret;

function secret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production' && configured.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters in production');
    return configured;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  if (!generatedDevelopmentSecret) generatedDevelopmentSecret = crypto.randomBytes(48).toString('base64url');
  return generatedDevelopmentSecret;
}

function assertAuthConfiguration() {
  secret();
}
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

function issueToken(user) {
  const payload = encode({ sub: user.id, role: user.role, exp: Date.now() + 8 * 60 * 60_000 });
  return `${payload}.${signature(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Authentication is required');
  const [payload, receivedSignature] = token.split('.');
  if (!payload || !receivedSignature || receivedSignature.length !== signature(payload).length || !crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(signature(payload)))) throw new Error('Invalid authentication token');
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.sub || !claims.role || claims.exp < Date.now()) throw new Error('Authentication token has expired');
    return { userId: claims.sub, role: claims.role };
  } catch (error) {
    if (error.message === 'Authentication token has expired') throw error;
    throw new Error('Invalid authentication token');
  }
}

function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authentication is required' });
  try {
    req.auth = verifyToken(token);
    return next();
  } catch (error) { return res.status(401).json({ error: error.message }); }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication is required' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'You do not have permission to perform this action' });
    return next();
  };
}

module.exports = { issueToken, verifyToken, authenticate, authorize, assertAuthConfiguration };
