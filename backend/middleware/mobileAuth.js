const mobileSessionService = require('../services/mobileSessionService');

function mobileError(res, req, error) {
  return res.status(error.status || 401).json({
    success: false,
    error: {
      code: error.code || 'AUTHENTICATION_REQUIRED',
      message: error.status === 401 ? 'Authentication is required' : error.message,
      retryable: false,
      requestId: req.requestId,
    },
  });
}

async function authenticateMobile(req, res, next) {
  try {
    const config = req.app.get('config');
    if (!config.mobile.enabled) {
      const error = new mobileSessionService.MobileAuthError('Mobile API is not enabled', 'MOBILE_API_DISABLED', 503);
      return mobileError(res, req, error);
    }
    const token = mobileSessionService.readBearerToken(req.get('authorization'));
    const session = await mobileSessionService.resolve(token, config);
    req.mobileSession = session;
    req.auth = { userId: session.userId, role: session.user.role };
    req.authUser = session.user;
    return next();
  } catch (error) {
    return mobileError(res, req, error);
  }
}

function requireMobileApp(...apps) {
  const allowed = new Set(apps);
  return (req, res, next) => {
    if (!req.mobileSession || !allowed.has(req.mobileSession.installation.app)) {
      return mobileError(res, req, new mobileSessionService.MobileAuthError('Application capability is not allowed', 'ROLE_NOT_ALLOWED', 403));
    }
    return next();
  };
}

module.exports = { authenticateMobile, mobileError, requireMobileApp };
