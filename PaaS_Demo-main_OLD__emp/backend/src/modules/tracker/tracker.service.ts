import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

export class TrackerService {
  async update(requestId: string, notes: string, opsUserId: string) {
    const request = await db.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Request not found');
    if (!['InProgress', 'Completed', 'PaymentReceived'].includes(request.status)) {
      throw ApiError.conflict(`Cannot update tracker — status is ${request.status}`);
    }

    return await db.$transaction(async (tx) => {
      await tx.requestTrackerEntry.upsert({
        where: { serviceRequestId: requestId },
        update: {
          updatedByOpsUserId: opsUserId,
          notes,
          updatedAt: new Date(),
        },
        create: {
          serviceRequestId: requestId,
          updatedByOpsUserId: opsUserId,
          notes,
        },
      });

      const nextStatus = ['Completed', 'PaymentReceived'].includes(request.status) ? 'TrackerUpdated' : request.status;
      const updatedRequest = await tx.serviceRequest.update({
        where: { id: requestId },
        data: { status: nextStatus },
      });

      const finance = await tx.user.findFirst({ where: { role: 'Finance' } });
      if (finance) {
        await tx.notificationItem.create({
          data: {
            userId: finance.id,
            title: 'Tracker Updated',
            message: `SR-${updatedRequest.requestNumber} ready for invoicing`,
            severity: 'success',
          },
        });
      }

      return { serviceRequestId: requestId, status: updatedRequest.status };
    });
  }
}

export const trackerService = new TrackerService();
