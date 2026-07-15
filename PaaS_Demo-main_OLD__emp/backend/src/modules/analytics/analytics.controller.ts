import type { Request, Response } from 'express';
import { analyticsService } from './analytics.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export class AnalyticsController {
  async getSnapshot(_req: Request, res: Response): Promise<void> {
    const data = await analyticsService.getSnapshot();
    ApiResponse.success(res, data);
  }
}

export const analyticsController = new AnalyticsController();
