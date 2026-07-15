import type { Request, Response } from 'express';
import { requestsService } from './requests.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { CreateRequestInput } from './requests.schema.js';

export class RequestsController {
  async list(req: Request, res: Response): Promise<void> {
    const filters = {
      customerId: req.query.customerId as string,
      pilotId: req.query.pilotId as string,
      status: req.query.status as string,
    };
    const data = await requestsService.listRequests(filters);
    ApiResponse.success(res, data);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const data = await requestsService.getById(String(req.params.id));
    ApiResponse.success(res, data);
  }

  async create(req: Request, res: Response): Promise<void> {
    const data = await requestsService.create(req.body as CreateRequestInput);
    ApiResponse.created(res, data);
  }
}

export const requestsController = new RequestsController();
