const prisma = require('../lib/prisma');

async function prepareDevelopmentDemo() {
  const testUsers = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: '@example.test' } }, { email: { endsWith: '@example.invalid' } }] },
    select: { id: true },
  });
  const userIds = testUsers.map((user) => user.id);
  const testLeads = await prisma.lead.findMany({
    where: { OR: [{ farmerName: { startsWith: 'Phase ' } }, { farmerName: { startsWith: 'Browser ' } }, { farmerName: { startsWith: 'Invalid ' } }, { farmerName: { startsWith: 'Security ' } }] },
    select: { id: true },
  });
  const leadIds = testLeads.map((lead) => lead.id);
  const testAssignments = await prisma.assignment.findMany({
    where: { OR: [...(userIds.length ? [{ pilotId: { in: userIds } }] : []), ...(leadIds.length ? [{ leadId: { in: leadIds } }] : [])] },
    select: { id: true },
  });
  const assignmentIds = testAssignments.map((assignment) => assignment.id);
  const testSessions = await prisma.chatSession.findMany({
    where: userIds.length ? { OR: [{ adminId: { in: userIds } }, { pilotId: { in: userIds } }] } : { id: { in: [] } },
    select: { id: true },
  });
  const sessionIds = testSessions.map((session) => session.id);

  await prisma.$transaction(async (transaction) => {
    if (sessionIds.length) {
      await transaction.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await transaction.chatSession.deleteMany({ where: { id: { in: sessionIds } } });
    }
    if (assignmentIds.length) {
      await transaction.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
      await transaction.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
      await transaction.paymentRecord.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
      await transaction.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    }
    if (leadIds.length) {
      await transaction.notification.deleteMany({ where: { leadId: { in: leadIds } } });
      await transaction.paymentRecord.deleteMany({ where: { leadId: { in: leadIds } } });
      await transaction.outOfRangeAppeal.deleteMany({ where: { leadId: { in: leadIds } } });
      await transaction.lead.deleteMany({ where: { id: { in: leadIds } } });
    }
    if (userIds.length) {
      await transaction.notification.deleteMany({ where: { recipientId: { in: userIds } } });
      await transaction.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await transaction.auditLog.deleteMany({ where: { OR: [
      ...(userIds.length ? [{ entityId: { in: userIds } }] : []),
      ...(leadIds.length ? [{ entityId: { in: leadIds } }] : []),
      ...(assignmentIds.length ? [{ entityId: { in: assignmentIds } }] : []),
      ...(sessionIds.length ? [{ entityId: { in: sessionIds } }] : []),
    ] } });
    await transaction.drone.deleteMany({ where: { OR: [{ serialNumber: { startsWith: 'PHASE' } }, { serialNumber: { startsWith: 'E2E-' } }, { serialNumber: { startsWith: 'SECURITY-' } }] } });
    await transaction.operatingCenter.deleteMany({ where: { OR: [{ name: { startsWith: 'Phase ' } }, { name: { startsWith: 'Browser ' } }, { name: { startsWith: 'Security ' } }] } });
    await transaction.pricingConfig.upsert({ where: { key: 'MAX_LEAD_ACREAGE' }, create: { key: 'MAX_LEAD_ACREAGE', value: 10000 }, update: {} });
  });
  return { removedUsers: userIds.length };
}

module.exports = { healthCheck: () => prisma.$queryRaw`SELECT 1 AS ok`, prepareDevelopmentDemo };
