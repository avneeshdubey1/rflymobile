const cashCollectionRepository = require('../src/repositories/cashCollectionRepository');

async function list(req, res, next) {
  try {
    const limit = typeof req.query.limit === 'undefined' ? 100 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'limit must be a whole number between 1 and 100' });
    }
    return res.json({ success: true, collections: await cashCollectionRepository.listForAdmin({ limit }) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list };
