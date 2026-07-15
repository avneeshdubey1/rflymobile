import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { BCPaymentInput, BBChecklistInput } from './payments.schema.js';
import type { PaymentResult } from './payments.types.js';

export class PaymentsService {
  async recordBCPayment(input: BCPaymentInput): Promise<PaymentResult> {
    try {
      const request = await db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request) throw ApiError.notFound('Request not found');
      if (request.customerType !== 'BC') throw ApiError.badRequest('B-C payment is only for B-C requests');
      if (request.status !== 'Completed') throw ApiError.conflict('Request must be completed before payment');

      return await db.$transaction(async (tx) => {
        await tx.bCPayment.upsert({
          where: { serviceRequestId: input.serviceRequestId },
          create: {
            serviceRequestId: input.serviceRequestId,
            upiTransactionRef: input.upiTransactionRef,
            amountPaid: input.amountPaid,
          },
          update: {
            upiTransactionRef: input.upiTransactionRef,
            amountPaid: input.amountPaid,
          }
        });

        const updatedRequest = await tx.serviceRequest.update({
          where: { id: input.serviceRequestId },
          data: { status: 'PaymentReceived' },
        });

        const admin = await tx.user.findFirst({ where: { role: 'Admin' } });
        if (admin) {
          await tx.notificationItem.create({
            data: {
              userId: admin.id,
              title: 'Payment Received',
              message: `SR-${updatedRequest.requestNumber} B-C payment ₹${input.amountPaid} collected`,
              severity: 'success',
            },
          });
        }

        return { serviceRequestId: updatedRequest.id, status: updatedRequest.status, message: 'Payment recorded' };
      });
    } catch (error) {
      console.error('ERROR in recordBCPayment:', error);
      throw error;
    }
  }

  async completeBBChecklist(input: BBChecklistInput): Promise<PaymentResult> {
    try {
      const request = await db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!request) throw ApiError.notFound('Request not found');
      if (request.customerType !== 'BB') throw ApiError.badRequest('Checklist is only for B-B requests');
      if (request.status !== 'Completed') throw ApiError.conflict('Request must be completed first');

      return await db.$transaction(async (tx) => {
        await tx.completionChecklist.upsert({
          where: { serviceRequestId: input.serviceRequestId },
          create: {
            serviceRequestId: input.serviceRequestId,
            billCollected: input.billCollected,
            billPhotoUrl: input.billPhotoUrl,
            screenshotUrl: input.screenshotUrl,
          },
          update: {
            billCollected: input.billCollected,
            billPhotoUrl: input.billPhotoUrl,
            screenshotUrl: input.screenshotUrl,
          }
        });

        const ops = await tx.user.findFirst({ where: { role: 'Ops' } });
        if (ops) {
          await tx.notificationItem.create({
            data: {
              userId: ops.id,
              title: 'B-B Checklist Done',
              message: `SR-${request.requestNumber} checklist completed — ready for tracker`,
              severity: 'info',
            },
          });
        }

        return { serviceRequestId: request.id, status: request.status, message: 'B-B checklist completed' };
      });
    } catch (error) {
      console.error('ERROR in completeBBChecklist:', error);
      throw error;
    }
  }
}

export const paymentsService = new PaymentsService();
