const auditLogService = require('./auditLogService');
const i18nService = require('./i18nService');

let client = null;

function setClient(nextClient) {
  client = nextClient;
}

async function sendLeadMessage(lead, templateKey, variables = {}) {
  const language = lead.preferredLanguage || 'ta';
  const text = i18nService.resolve(templateKey, language, variables);
  const delivery = {
    leadId: lead.id,
    templateKey,
    language,
    text,
    to: lead.farmerPhone,
    variables,
  };
  try {
    if (!client) {
      await auditLogService.record({ entityType: 'Lead', entityId: lead.id, action: 'WHATSAPP_MOCK_DELIVERY', afterState: { templateKey, language, deliveryStatus: 'MOCKED' } });
      return { ...delivery, status: 'MOCKED' };
    }
    const providerResult = await client.send(delivery);
    await auditLogService.record({ entityType: 'Lead', entityId: lead.id, action: 'WHATSAPP_DELIVERED', afterState: { templateKey, language, deliveryStatus: 'SENT', providerMessageId: providerResult?.id || null } });
    return { ...delivery, status: 'SENT', providerMessageId: providerResult?.id || null };
  } catch (error) {
    await auditLogService.record({ entityType: 'Lead', entityId: lead.id, action: 'WHATSAPP_DELIVERY_FAILED', afterState: { templateKey, language, deliveryStatus: 'FAILED' }, reason: error.message });
    return { ...delivery, status: 'FAILED', error: error.message };
  }
}

function sendForStatus(lead, status, variables = {}) {
  const templateKey = {
    PROCESSED: 'lead_processed',
    SCHEDULED: 'mission_scheduled',
    IN_PROGRESS: 'mission_started',
    COMPLETED: 'mission_completed',
  }[status];
  if (!templateKey) throw new Error(`No WhatsApp template for lead status: ${status}`);
  return sendLeadMessage(lead, templateKey, variables);
}

function localizedDate(date, language) {
  const locale = i18nService.languageLocales[i18nService.isSupportedLanguage(language) ? language : 'en'];
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date));
}

function sendMissionScheduled(lead, scheduledDate) {
  return sendForStatus(lead, 'SCHEDULED', { scheduledDate: localizedDate(scheduledDate, lead.preferredLanguage) });
}

function sendMissionCompleted(lead, actualAcreage, invoiceLink = null) {
  const invoiceNote = invoiceLink ? i18nService.resolve('invoice_link', lead.preferredLanguage, { invoiceLink }) : i18nService.resolve('invoice_pending', lead.preferredLanguage);
  return sendForStatus(lead, 'COMPLETED', { actualAcreage, invoiceNote });
}

module.exports = { setClient, sendLeadMessage, sendForStatus, sendMissionScheduled, sendMissionCompleted };
