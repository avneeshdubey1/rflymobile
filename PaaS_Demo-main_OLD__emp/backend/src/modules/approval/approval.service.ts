import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { BBApprovalInput } from './approval.schema.js';

export class ApprovalService {
  async submitApproval(requestId: string, input: BBApprovalInput) {
    const request = await db.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Request not found');
    if (request.customerType !== 'BB') throw ApiError.badRequest('Approval is only for B-B requests');
    if (request.status !== 'RepresentativeApprovalPending') throw ApiError.conflict(`Cannot approve — status is ${request.status}`);

    return await db.$transaction(async (tx) => {
      await tx.bBRepresentativeApproval.update({
        where: { serviceRequestId: requestId },
        data: {
          isApproved: input.isApproved,
          approvedAt: input.isApproved ? new Date() : null,
          rejectionReason: input.rejectionReason ?? null,
        },
      });

      const nextStatus = input.isApproved ? 'Accepted' : 'RepresentativeRejected';

      const updatedRequest = await tx.serviceRequest.update({
        where: { id: requestId },
        data: { status: nextStatus },
      });

      if (!input.isApproved) {
        const admin = await tx.user.findFirst({ where: { role: 'Admin' } });
        if (admin) {
          await tx.notificationItem.create({
            data: {
              userId: admin.id,
              title: 'Approval Rejected',
              message: `SR-${updatedRequest.requestNumber} was rejected: ${input.rejectionReason ?? 'No reason'}`,
              severity: 'error',
            },
          });
        }
      }

      return { serviceRequestId: requestId, isApproved: input.isApproved, status: updatedRequest.status };
    });
  }
}

export const approvalService = new ApprovalService();
