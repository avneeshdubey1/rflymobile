require('dotenv').config({ quiet: true });
const auditLogRepository = require('../src/repositories/auditLogRepository');
const prisma = require('../src/lib/prisma');

async function main() {
  const result = await auditLogRepository.redactStoredSnapshots();
  await auditLogRepository.create({
    entityType: 'System',
    entityId: 'audit-privacy-maintenance',
    action: 'AUDIT_PRIVACY_REDACTION_COMPLETED',
    afterState: { recordsExamined: result.examined, recordsRedacted: result.redacted },
  });
  // Deliberately report counts only. Audit payloads can contain private data.
  process.stdout.write(`Audit snapshot cleanup complete: ${result.redacted} of ${result.examined} records updated.\n`);
}

main()
  .catch(() => {
    process.stderr.write('Audit snapshot cleanup failed. No audit values were printed.\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
