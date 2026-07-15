import type { Request, Response } from 'express';
import { financeService } from './finance.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { GenerateInvoiceInput } from './finance.schema.js';

export class FinanceController {
  async list(_req: Request, res: Response): Promise<void> {
    const data = await financeService.listInvoices();
    ApiResponse.success(res, data);
  }

  async generate(req: Request, res: Response): Promise<void> {
    const { customerId } = req.body as GenerateInvoiceInput;
    const data = await financeService.generateInvoice(customerId);
    ApiResponse.created(res, data);
  }
}

export const financeController = new FinanceController();
