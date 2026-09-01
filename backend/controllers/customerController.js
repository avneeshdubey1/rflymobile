const customerService = require('../services/customerService');
const intakeController = require('./intakeController');

exports.search = async (req, res) => {
  try {
    const result = await customerService.searchForSales({
      query: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json({ success: true, ...result });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to search customers' });
  }
};

exports.create = async (req, res) => {
  try {
    const result = await customerService.createForSales(req.body, req.auth.userId);
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    const validationError = /required|between|valid|must|available|assigned/i.test(error.message || '');
    const status = error.code === 'P2002' ? 409 : error.status || (validationError ? 400 : 500);
    return res.status(status).json({
      error: error.code === 'P2002' ? 'That customer phone is already registered' : status < 500 ? error.message : 'Failed to create customer',
      ...(error.code && error.code !== 'P2002' ? { code: error.code } : {}),
    });
  }
};

exports.update = async (req, res) => {
  try {
    const customer = await customerService.updateForSales(req.params.customerId, req.body, req.auth.userId);
    return res.json({ success: true, customer });
  } catch (error) {
    const status = error.status || (/required|between|valid|must|cannot|number|whole/i.test(error.message || '') ? 400 : 500);
    return res.status(status).json({
      error: status < 500 ? error.message : 'Failed to update customer',
    });
  }
};

exports.serviceContext = async (req, res) => {
  try {
    const customer = await customerService.openServiceContext(req.params.customerId, req.auth.userId);
    return res.json({ success: true, customer });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status === 404 ? error.message : 'Failed to open customer service view' });
  }
};

exports.enablePortalAccess = async (req, res) => {
  try {
    const result = await customerService.enableFarmerPortalAccess(req.params.customerId, req.auth.userId);
    return res.status(result.createdUser ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status === 404 || error.status === 409 ? error.message : 'Failed to enable farmer portal access',
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

exports.createLeadForCustomer = async (req, res) => {
  try {
    const customer = await customerService.getServiceContext(req.params.customerId);
    return await intakeController.submit(req, res, {
      intakeChannel: 'MANUAL_SALES',
      actorId: req.auth.userId,
      farmerName: customer.displayName,
      farmerPhone: customer.phone,
      preferredLanguage: customer.preferredLanguage || 'ta',
      customerId: customer.id,
      autoAssign: true,
    });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message || 'Failed to create customer lead' });
  }
};
