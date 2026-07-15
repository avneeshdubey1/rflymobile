const healthService = require('../services/healthService');

exports.getHealth = async (req, res) => {
  const health = await healthService.getHealth();
  if (req.app.get('config').isProduction) {
    return res.status(health.status === 'ok' ? 200 : 503).json({ status: health.status });
  }
  res.status(health.status === 'ok' ? 200 : 503).json(health);
};

exports.getDetailedHealth = async (_req, res) => {
  const health = await healthService.getHealth();
  return res.status(health.status === 'ok' ? 200 : 503).json(health);
};
