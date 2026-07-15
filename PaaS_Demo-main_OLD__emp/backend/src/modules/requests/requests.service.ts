import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { CreateRequestInput } from './requests.schema.js';

export class RequestsService {
  async listRequests(filters: { customerId?: string; pilotId?: string; status?: string }) {
    const where: any = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.pilotId) {
      where.assignment = {
        pilotId: filters.pilotId,
      };
    }

    const requests = await db.serviceRequest.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        assignment: {
          include: {
            pilot: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  async getById(id: string) {
    const request = await db.serviceRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        assignment: { include: { pilot: true } },
        approval: true,
        payment: true,
        checklist: true,
        tracker: true,
      },
    });

    if (!request) throw ApiError.notFound('Service request not found');
    return request;
  }

  async create(input: CreateRequestInput) {
    const customer = await db.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw ApiError.notFound('Customer not found');

    const request = await db.serviceRequest.create({
      data: {
        customerId: input.customerId,
        customerType: customer.type,
        cropType: input.cropType,
        fieldAreaAcres: input.fieldAreaAcres,
        requestedDate: new Date(input.requestedDate),
        requestedTimeSlot: input.requestedTimeSlot,
        chemical: input.chemical,
        sourceOfRequest: input.sourceOfRequest,
        amountPerAcre: input.amountPerAcre,
        notes: input.notes,
        status: 'Pending',
      },
    });

    await db.notificationItem.create({
      data: {
        userId: (await db.user.findFirst({ where: { role: 'Admin' } }))?.id || '',
        title: 'New Service Request',
        message: `SR-${request.requestNumber} from ${customer.name} needs assignment`,
        severity: 'info',
      },
    });

    return request;
  }
}

export const requestsService = new RequestsService();
