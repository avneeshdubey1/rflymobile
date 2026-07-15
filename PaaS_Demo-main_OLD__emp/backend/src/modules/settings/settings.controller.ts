import type { Request, Response } from 'express';
import { settingsService } from './settings.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { createTimeSlotSchema, toggleTimeSlotSchema, updateConfigSchema } from './settings.schema.js';
import { ApiError } from '../../utils/ApiError.js';

export class SettingsController {
  async getTimeSlots(_req: Request, res: Response): Promise<void> {
    const slots = await settingsService.listTimeSlots();
    ApiResponse.success(res, slots);
  }

  async createTimeSlot(req: Request, res: Response): Promise<void> {
    const parsed = createTimeSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid time slot payload', parsed.error.format());
    }

    const slot = await settingsService.createTimeSlot(parsed.data);
    ApiResponse.created(res, slot);
  }

  async toggleTimeSlot(req: Request, res: Response): Promise<void> {
    const parsed = toggleTimeSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid toggle payload', parsed.error.format());
    }

    const slot = await settingsService.toggleTimeSlot(req.params.id as string, parsed.data);
    ApiResponse.success(res, slot);
  }

  async deleteTimeSlot(req: Request, res: Response): Promise<void> {
    await settingsService.deleteTimeSlot(req.params.id as string);
    ApiResponse.success(res, { message: 'Time slot deleted successfully' });
  }

  async getConfigs(_req: Request, res: Response): Promise<void> {
    const configs = await settingsService.listConfigs();
    ApiResponse.success(res, configs);
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid config payload', parsed.error.format());
    }

    const config = await settingsService.updateConfig(parsed.data);
    ApiResponse.success(res, config);
  }
}

export const settingsController = new SettingsController();
