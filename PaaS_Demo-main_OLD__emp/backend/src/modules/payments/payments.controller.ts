import type { Request, Response } from 'express';
import { paymentsService } from './payments.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { BCPaymentInput, BBChecklistInput } from './payments.schema.js';

export class PaymentsController {
  async recordBC(req: Request, res: Response): Promise<void> {
    const data = await paymentsService.recordBCPayment(req.body as BCPaymentInput);
    ApiResponse.success(res, data);
  }

  async bbChecklist(req: Request, res: Response): Promise<void> {
    const data = await paymentsService.completeBBChecklist(req.body as BBChecklistInput);
    ApiResponse.success(res, data);
  }
}

export const paymentsController = new PaymentsController();
