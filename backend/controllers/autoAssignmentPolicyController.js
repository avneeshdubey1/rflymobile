const autoAssignmentPolicyService = require('../services/autoAssignmentPolicyService');

function present(policy) {
  return {
    id: policy.id,
    singletonKey: policy.singletonKey,
    enabled: policy.enabled,
    searchHorizonDays: policy.searchHorizonDays,
    workingDayStartMinutes: policy.workingDayStartMinutes,
    workingDayEndMinutes: policy.workingDayEndMinutes,
    defaultJobDurationMinutes: policy.defaultJobDurationMinutes,
    turnaroundMinutes: policy.turnaroundMinutes,
    maxJobsPerUnitPerDay: policy.maxJobsPerUnitPerDay,
    maxAcreagePerUnitPerDay: policy.maxAcreagePerUnitPerDay?.toString() ?? null,
    weatherUnavailableAction: policy.weatherUnavailableAction,
    revision: policy.revision,
    updatedByUserId: policy.updatedByUserId,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

function statusFor(error) {
  if (error.code === 'POLICY_REVISION_CONFLICT') return 409;
  if (error.code === 'POLICY_UNAVAILABLE') return 503;
  if (error.code === 'POLICY_VALIDATION_FAILED') return 422;
  if (error.code === 'POLICY_ACTOR_REQUIRED') return 401;
  return 400;
}

exports.get = async (_req, res, next) => {
  try {
    return res.json({ success: true, policy: present(await autoAssignmentPolicyService.getPolicy()) });
  } catch (error) {
    if (!error.code) return next(error);
    return res.status(statusFor(error)).json({ error: error.message, code: error.code });
  }
};

exports.summary = async (_req, res, next) => {
  try {
    const policy = await autoAssignmentPolicyService.getPolicy();
    return res.json({
      success: true,
      policy: {
        mode: policy.enabled ? 'automatic' : 'manual',
        enabled: policy.enabled,
        revision: policy.revision,
      },
    });
  } catch (error) {
    if (!error.code) return next(error);
    return res.status(statusFor(error)).json({ error: error.message, code: error.code });
  }
};

exports.update = async (req, res, next) => {
  try {
    const { expectedRevision, ...changes } = req.body || {};
    const policy = await autoAssignmentPolicyService.updatePolicy({
      actorId: req.auth.userId,
      expectedRevision,
      changes,
    });
    return res.json({ success: true, policy: present(policy) });
  } catch (error) {
    if (!error.code) return next(error);
    return res.status(statusFor(error)).json({
      error: error.message,
      code: error.code,
      ...(error.currentRevision ? { currentRevision: error.currentRevision } : {}),
    });
  }
};

exports.present = present;
