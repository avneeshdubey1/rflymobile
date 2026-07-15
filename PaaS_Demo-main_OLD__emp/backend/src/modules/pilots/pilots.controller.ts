import type { Request, Response } from 'express';
import { pilotsService } from './pilots.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export class PilotsController {
  async list(_req: Request, res: Response): Promise<void> {
    const data = await pilotsService.listPilots();
    ApiResponse.success(res, data);
  }
}

export const pilotsController = new PilotsController();
