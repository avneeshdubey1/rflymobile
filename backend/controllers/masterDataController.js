const service = require('../services/masterDataService');

function respond(res, work, created = false) {
  return work.then((data) => res.status(created ? 201 : 200).json({ success: true, data }))
    .catch((error) => {
      const status = error.status || (error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : 500);
      return res.status(status).json({ error: status < 500 ? error.message : 'Master data operation failed' });
    });
}

exports.choices = (_req, res) => respond(res, service.choices());
exports.listAdmin = (_req, res) => respond(res, service.listAdmin());
exports.createCluster = (req, res) => respond(res, service.createCluster(req.body, req.auth.userId), true);
exports.updateCluster = (req, res) => respond(res, service.updateCluster(req.params.id, req.body, req.auth.userId));
exports.createValue = (req, res) => respond(res, service.createValue(req.body, req.auth.userId), true);
exports.updateValue = (req, res) => respond(res, service.updateValue(req.params.id, req.body, req.auth.userId));
exports.createCrop = (req, res) => respond(res, service.createCrop(req.body, req.auth.userId), true);
exports.updateCrop = (req, res) => respond(res, service.updateCrop(req.params.id, req.body, req.auth.userId));
