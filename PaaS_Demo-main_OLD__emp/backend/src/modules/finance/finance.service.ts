import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { Invoice } from '@prisma/client';

export class FinanceService {
  async listInvoices(): Promise<Invoice[]> {
    return await db.invoice.findMany({
      include: { customer: true },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async generateInvoice(customerId: string): Promise<Invoice> {
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw ApiError.notFound('Customer not found');
    if (customer.type !== 'BB') throw ApiError.badRequest('Invoices are only for B-B customers');

    const eligibleRequests = await db.serviceRequest.findMany({
      where: { customerId, status: 'TrackerUpdated' },
    });

    if (eligibleRequests.length === 0) {
      throw ApiError.conflict('No eligible (TrackerUpdated) requests for invoicing');
    }

    const totalAmount = eligibleRequests.reduce((sum, r) => sum + Number(r.fieldAreaAcres) * Number(r.amountPerAcre), 0);

    return await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          customerId,
          billingPeriodStart: new Date(),
          billingPeriodEnd: new Date(),
          jobIds: eligibleRequests.map(r => r.id),
          totalAmount,
          invoiceDate: new Date(),
          status: 'Draft',
        },
      });

      await tx.serviceRequest.updateMany({
        where: { id: { in: eligibleRequests.map(r => r.id) } },
        data: { status: 'Invoiced' },
      });

      const admin = await tx.user.findFirst({ where: { role: 'Admin' } });
      if (admin) {
        await tx.notificationItem.create({
          data: {
            userId: admin.id,
            title: 'Invoice Generated',
            message: `INV-${invoice.invoiceNumber} for ${customer.name} — ₹${totalAmount}`,
            severity: 'success',
          },
        });
      }

      return invoice;
    });
  }
}

export const financeService = new FinanceService();
