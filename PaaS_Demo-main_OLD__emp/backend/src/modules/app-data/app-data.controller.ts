import type { Request, Response } from 'express';
import { db } from '../../config/db.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export class AppDataController {
  async getAppData(req: Request, res: Response): Promise<void> {
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    const currentUser = await db.user.findUnique({ where: { id: userId } });
    const customerId = currentUser?.customerId;

    const [users, customers, requests, invoices, notifications, timeSlots, configs] = await Promise.all([
      db.user.findMany(),
      db.customer.findMany(),
      // Pilots only see their assigned requests; BC/BB see their own; Reps see their assigned ones; others see all
      userRole === 'Pilot' 
        ? db.serviceRequest.findMany({
            where: { assignment: { pilotId: userId } },
            include: { assignment: true, approval: true, checklist: true, payment: true, tracker: true }
          })
        : userRole === 'Representative'
        ? db.serviceRequest.findMany({
            where: { assignment: { representativeId: userId } },
            include: { assignment: true, approval: true, checklist: true, payment: true, tracker: true }
          })
        : (userRole === 'BC' || userRole === 'BB') && customerId
        ? db.serviceRequest.findMany({
            where: { customerId: customerId },
            include: { assignment: true, approval: true, checklist: true, payment: true, tracker: true }
          })
        : db.serviceRequest.findMany({
            include: { assignment: true, approval: true, checklist: true, payment: true, tracker: true }
          }),
      db.invoice.findMany(),
      db.notificationItem.findMany({ where: { userId } }),
      db.timeSlot.findMany({ orderBy: { slot: 'asc' } }),
      db.systemConfig.findMany(),
    ]);

    ApiResponse.success(res, {
      users,
      customers,
      requests,
      invoices,
      notifications,
      timeSlots,
      configs,
    });
  }
}

export const appDataController = new AppDataController();
