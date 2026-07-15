import type { Request, Response } from 'express';
import { trackerService } from './tracker.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { TrackerUpdateInput } from './tracker.schema.js';

export class TrackerController {
  async update(req: Request, res: Response): Promise<void> {
    const { notes } = req.body as TrackerUpdateInput;
    const data = await trackerService.update(String(req.params.requestId), notes, req.user!.userId);
    ApiResponse.success(res, data);
  }
}

export const trackerController = new TrackerController();
