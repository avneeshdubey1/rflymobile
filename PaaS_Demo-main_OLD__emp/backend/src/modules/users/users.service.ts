import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { CreateUserInput, UpdateUserStatusInput } from './users.schema.js';

export class UsersService {
  async listUsers() {
    return await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        customerId: true,
      },
    });
  }

  async createUser(input: CreateUserInput) {
    const existing = await db.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw ApiError.conflict('User with this phone number already exists');
    }

    if (input.role === 'BC' || input.role === 'BB') {
      const customer = await db.customer.create({
        data: {
          name: input.name,
          phone: input.phone,
          type: input.role as 'BC' | 'BB',
          address: input.address,
          region: input.region,
          billingCycleDays: input.billingCycleDays ?? (input.role === 'BB' ? 15 : 0),
        },
      });

      return await db.user.create({
        data: {
          name: input.name,
          phone: input.phone,
          role: input.role,
          isActive: true,
          customerId: customer.id,
        },
      });
    }

    return await db.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        role: input.role,
        isActive: true,
      },
    });
  }

  async updateUserStatus(id: string, input: UpdateUserStatusInput) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found');
    
    // Prevent admins from suspending themselves
    if (user.role === 'Admin' && !input.isActive) {
      const activeAdmins = await db.user.count({ where: { role: 'Admin', isActive: true } });
      if (activeAdmins <= 1) {
        throw ApiError.conflict('Cannot suspend the last active Admin');
      }
    }

    return await db.user.update({
      where: { id },
      data: { isActive: input.isActive },
    });
  }

  async deleteUser(id: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found');

    if (user.role === 'Admin') {
      const adminCount = await db.user.count({ where: { role: 'Admin' } });
      if (adminCount <= 1) {
        throw ApiError.conflict('Cannot delete the last Admin');
      }
    }

    // Check for existing relations before deleting (pilots might have assignments)
    if (user.role === 'Pilot') {
      const activeJobs = await db.pilotAssignment.count({
        where: { pilotId: id, serviceRequest: { status: { in: ['Assigned', 'InProgress'] } } }
      });
      if (activeJobs > 0) throw ApiError.conflict('Cannot delete pilot with active jobs');
    }

    await db.$transaction(async (tx) => {
      // 1. Delete notifications for this user
      await tx.notificationItem.deleteMany({ where: { userId: id } });

      // 2. Set representativeId = null on any pilot assignments where this user is the representative
      await tx.pilotAssignment.updateMany({
        where: { representativeId: id },
        data: { representativeId: null }
      });

      // 3. Set representativeUserId = null on any representative approvals where this user is the rep
      await tx.bBRepresentativeApproval.updateMany({
        where: { representativeUserId: id },
        data: { representativeUserId: null }
      });

      // 4. Update request tracker entries: change updatedByOpsUserId to another admin or ops user so we don't lose logs!
      const fallbackUser = await tx.user.findFirst({
        where: { role: 'Admin', id: { not: id } }
      });
      if (fallbackUser) {
        await tx.requestTrackerEntry.updateMany({
          where: { updatedByOpsUserId: id },
          data: { updatedByOpsUserId: fallbackUser.id }
        });
      } else {
        // If no fallback admin exists, just delete tracker entries to prevent constraint violation
        await tx.requestTrackerEntry.deleteMany({
          where: { updatedByOpsUserId: id }
        });
      }

      // 5. Delete historical pilot assignments for the pilot
      if (user.role === 'Pilot') {
        const assignments = await tx.pilotAssignment.findMany({
          where: { pilotId: id }
        });
        
        const requestIds = assignments.map(a => a.serviceRequestId);

        await tx.pilotAssignment.deleteMany({
          where: { pilotId: id }
        });

        // Revert any associated request statuses to 'Pending' if they were assigned but not completed
        if (requestIds.length > 0) {
          await tx.serviceRequest.updateMany({
            where: { 
              id: { in: requestIds },
              status: { in: ['Assigned', 'Accepted', 'RepresentativeApprovalPending'] }
            },
            data: { status: 'Pending' }
          });
        }
      }

      // 6. Finally delete the user
      await tx.user.delete({ where: { id } });
    });
  }
}

export const usersService = new UsersService();
