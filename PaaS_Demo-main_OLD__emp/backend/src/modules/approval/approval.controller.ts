import type { Request, Response } from 'express';
import { approvalService } from './approval.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { BBApprovalInput } from './approval.schema.js';

export class ApprovalController {
  async submit(req: Request, res: Response): Promise<void> {
    const userRole = req.user!.role;
    if (userRole !== 'Admin' && userRole !== 'Representative') {
      throw new Error('Only Admin or Representative can submit approvals');
    }
    const data = await approvalService.submitApproval(String(req.params.requestId), req.body as BBApprovalInput);
    ApiResponse.success(res, data);
  }
}

export const approvalController = new ApprovalController();
