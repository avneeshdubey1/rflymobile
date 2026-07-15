const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const assignments = await prisma.assignment.findMany({ include: { lead: true } });
  console.log('Assignments:', JSON.stringify(assignments.map(a => ({ id: a.id, leadId: a.lead.id, farmerName: a.lead.farmerName, intake: a.lead.intakeChannel, pilotId: a.pilotId, scheduledDate: a.scheduledDate })), null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
