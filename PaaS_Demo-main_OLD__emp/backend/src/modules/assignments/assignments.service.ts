import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AssignPilotInput } from './assignments.schema.js';

export class AssignmentsService {
  async assign(input: AssignPilotInput) {
    const request = await db.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
    if (!request) throw ApiError.notFound('Service request not found');
    if (request.status !== 'Pending') throw ApiError.conflict(`Cannot assign — request is ${request.status}`);

    const pilot = await db.user.findUnique({ where: { id: input.pilotId, role: 'Pilot' } });
    if (!pilot) throw ApiError.notFound('Pilot not found');

    if (request.customerType === 'BB' && !input.representativeId) {
      throw ApiError.badRequest('B-B requests require a representative assignment');
    }

    const activeJob = await db.serviceRequest.findFirst({
      where: {
        status: 'InProgress',
        assignment: { pilotId: input.pilotId },
      },
    });
    if (activeJob) throw ApiError.conflict(`Pilot ${pilot.name} already has an active job: SR-${activeJob.requestNumber}`);

    return await db.$transaction(async (tx) => {
      const assignment = await tx.pilotAssignment.create({
        data: {
          serviceRequestId: input.serviceRequestId,
          pilotId: input.pilotId,
          representativeId: request.customerType === 'BB' ? input.representativeId : null,
        },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { id: input.serviceRequestId },
        data: { status: 'Assigned' },
      });

      await tx.notificationItem.create({
        data: {
          userId: input.pilotId,
          title: 'New Job Assigned',
          message: `You've been assigned SR-${updatedRequest.requestNumber} — ${updatedRequest.cropType}`,
          severity: 'info',
        },
      });

      return { assignmentId: assignment.id, serviceRequestId: updatedRequest.id, pilotId: input.pilotId, status: updatedRequest.status };
    });
  }

  async accept(serviceRequestId: string, pilotId: string) {
    const request = await db.serviceRequest.findUnique({ where: { id: serviceRequestId }, include: { assignment: true } });
    if (!request) throw ApiError.notFound('Request not found');
    if (request.status !== 'Assigned') throw ApiError.conflict(`Cannot accept — status is ${request.status}`);
    if (request.assignment?.pilotId !== pilotId) throw ApiError.forbidden('This job is not assigned to you');

    return await db.$transaction(async (tx) => {
      await tx.pilotAssignment.update({
        where: { id: request.assignment!.id },
        data: { acceptedAt: new Date() },
      });

      const nextStatus = request.customerType === 'BB' ? 'RepresentativeApprovalPending' : 'Accepted';
      
      const updatedRequest = await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { status: nextStatus },
      });

      if (request.customerType === 'BB' && request.assignment?.representativeId) {
        const rep = await tx.user.findUnique({ where: { id: request.assignment.representativeId } });
        if (rep) {
          await tx.bBRepresentativeApproval.create({
            data: {
              serviceRequestId,
              representativeName: rep.name,
              representativePhone: rep.phone,
              representativeUserId: rep.id,
              isApproved: false,
            },
          });

          await tx.notificationItem.create({
            data: {
              userId: rep.id,
              title: 'Action Required: Pilot Accepted Job',
              message: `Pilot has accepted SR-${updatedRequest.requestNumber}. Please approve to proceed.`,
              severity: 'warning',
            },
          });
        }
      }

      const admin = await tx.user.findFirst({ where: { role: 'Admin' } });
      if (admin) {
        await tx.notificationItem.create({
          data: {
            userId: admin.id,
            title: 'Job Accepted',
            message: `SR-${updatedRequest.requestNumber} accepted by pilot`,
            severity: 'success',
          },
        });
      }

      return { serviceRequestId: updatedRequest.id, status: updatedRequest.status };
    });
  }

  async startSpraying(serviceRequestId: string, pilotId: string) {
    const request = await db.serviceRequest.findUnique({ where: { id: serviceRequestId }, include: { assignment: true } });
    if (!request) throw ApiError.notFound('Request not found');

    if (request.customerType === 'BB' && request.status === 'RepresentativeApprovalPending') {
      throw ApiError.conflict('B-B requests require representative approval before spraying');
    }
    if (!['Accepted', 'RepresentativeApprovalPending'].includes(request.status)) {
      if (request.status !== 'Accepted') {
        throw ApiError.conflict(`Cannot start spraying — status is ${request.status}`);
      }
    }
    if (request.assignment?.pilotId !== pilotId) throw ApiError.forbidden('Not your job');

    return await db.$transaction(async (tx) => {
      await tx.pilotAssignment.update({
        where: { id: request.assignment!.id },
        data: { startSprayingAt: new Date() },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { status: 'InProgress' },
      });

      return { serviceRequestId: updatedRequest.id, status: updatedRequest.status };
    });
  }

  async completeSpraying(serviceRequestId: string, pilotId: string) {
    const request = await db.serviceRequest.findUnique({ where: { id: serviceRequestId }, include: { assignment: true } });
    if (!request) throw ApiError.notFound('Request not found');
    if (request.status !== 'InProgress') throw ApiError.conflict(`Cannot complete — status is ${request.status}`);
    if (request.assignment?.pilotId !== pilotId) throw ApiError.forbidden('Not your job');

    return await db.$transaction(async (tx) => {
      await tx.pilotAssignment.update({
        where: { id: request.assignment!.id },
        data: { completeSprayingAt: new Date() },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { status: 'Completed' },
      });

      const ops = await tx.user.findFirst({ where: { role: 'Ops' } });
      if (ops) {
        await tx.notificationItem.create({
          data: {
            userId: ops.id,
            title: 'Job Completed',
            message: `SR-${updatedRequest.requestNumber} spraying completed — needs tracker update`,
            severity: 'warning',
          },
        });
      }

      return { serviceRequestId: updatedRequest.id, status: updatedRequest.status };
    });
  }
}

export const assignmentsService = new AssignmentsService();
