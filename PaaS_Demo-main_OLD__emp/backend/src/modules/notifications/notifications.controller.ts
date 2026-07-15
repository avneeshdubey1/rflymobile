import type { Request, Response } from 'express';
import { notificationsService } from './notifications.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export class NotificationsController {
  async list(req: Request, res: Response): Promise<void> {
    const data = await notificationsService.listForUser(req.user!.userId);
    ApiResponse.success(res, data);
  }

  async markRead(req: Request, res: Response): Promise<void> {
    const data = await notificationsService.markAsRead(String(req.params.id), req.user!.userId);
    ApiResponse.success(res, data);
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    const count = await notificationsService.markAllRead(req.user!.userId);
    ApiResponse.success(res, { markedRead: count });
  }
}

export const notificationsController = new NotificationsController();
