const recoveryService = require('../services/recoveryService');
const { disconnectUserSockets } = require('../middleware/auth');

exports.request = async (req, res) => {
  try {
    const result = await recoveryService.requestEmployeeRecovery({
      identifier: req.body.identifier,
      requestedChannel: req.body.channel,
    }, req.app.get('config'));
    return res.status(202).json(result);
  } catch (error) {
    console.error('Recovery request failed', { error: error.name, code: error.code });
    // Account discovery remains impossible even when a downstream provider is
    // unavailable or an identifier is malformed.
    return res.status(202).json({ success: true, message: recoveryService.GENERIC_MESSAGE });
  }
};

exports.complete = async (req, res) => {
  try {
    const result = await recoveryService.completeRecovery({
      challengeId: req.body.challengeId,
      code: req.body.code,
      newPassword: req.body.newPassword,
      allowedRoles: recoveryService.EMPLOYEE_ROLES,
    }, req.app.get('config'));
    disconnectUserSockets(req.app.get('io'), result.userId);
    return res.json({ success: true, message: 'Password updated successfully. Please sign in again.' });
  } catch (error) {
    const isValidation = /between|required/i.test(error.message || '');
    return res.status(isValidation ? 400 : error.status || 500).json({
      error: isValidation ? error.message : error.status ? 'The recovery challenge is invalid or has expired' : 'Password reset failed',
      ...(error.code ? { code: error.code } : {}),
    });
  }
};
