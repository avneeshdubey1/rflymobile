import type { Request, Response } from 'express';
import { assignmentsService } from './assignments.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { AssignPilotInput } from './assignments.schema.js';

export class AssignmentsController {
  async assign(req: Request, res: Response): Promise<void> {
    const data = await assignmentsService.assign(req.body as AssignPilotInput);
    ApiResponse.created(res, data);
  }

  async accept(req: Request, res: Response): Promise<void> {
    const data = await assignmentsService.accept(String(req.params.id), req.user!.userId);
    ApiResponse.success(res, data);
  }

  async startSpraying(req: Request, res: Response): Promise<void> {
    const data = await assignmentsService.startSpraying(String(req.params.id), req.user!.userId);
    ApiResponse.success(res, data);
  }

  async completeSpraying(req: Request, res: Response): Promise<void> {
    const data = await assignmentsService.completeSpraying(String(req.params.id), req.user!.userId);
    ApiResponse.success(res, data);
  }
}

export const assignmentsController = new AssignmentsController();
