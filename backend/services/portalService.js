const portalRepository = require('../src/repositories/portalRepository');

function summarizeLeads(leads = []) {
  const totals = leads.reduce((summary, lead) => {
    if (['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'].includes(lead.status)) summary.active += 1;
    if (lead.status === 'COMPLETED') summary.completed += 1;
    summary.total += 1;
    summary.payments += lead.payments?.length || 0;
    return summary;
  }, { active: 0, completed: 0, total: 0, payments: 0 });
  return { leads, totals };
}

async function farmerPortal(user) {
  if (user.role !== 'FARMER') {
    const error = new Error('Farmer portal access requires a Farmer account');
    error.status = 403;
    throw error;
  }
  const customer = await portalRepository.findCustomerByFarmerUserId(user.id);
  if (!customer) return { customer: null, leads: [], totals: { active: 0, completed: 0, total: 0, payments: 0 } };
  const leads = await portalRepository.findFarmerLeads(customer.id);
  return { customer, ...summarizeLeads(leads) };
}

async function businessPortal(user) {
  if (user.role !== 'BUSINESS') {
    const error = new Error('Business portal access requires a Business account');
    error.status = 403;
    throw error;
  }
  const memberships = await portalRepository.findBusinessMemberships(user.id);
  const organizations = memberships.map((membership) => {
    const { leads, ...organization } = membership.organization;
    return { ...organization, ...summarizeLeads(leads) };
  });
  const totals = organizations.reduce((summary, organization) => ({
    active: summary.active + organization.totals.active,
    completed: summary.completed + organization.totals.completed,
    total: summary.total + organization.totals.total,
    payments: summary.payments + organization.totals.payments,
  }), { active: 0, completed: 0, total: 0, payments: 0 });
  return { organizations, totals };
}

module.exports = { businessPortal, farmerPortal };
