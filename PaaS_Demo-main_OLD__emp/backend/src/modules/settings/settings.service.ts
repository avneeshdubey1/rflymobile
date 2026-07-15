import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { CreateTimeSlotInput, ToggleTimeSlotInput, UpdateConfigInput } from './settings.schema.js';

export class SettingsService {
  async listTimeSlots() {
    return await db.timeSlot.findMany({
      orderBy: { slot: 'asc' },
    });
  }

  async createTimeSlot(input: CreateTimeSlotInput) {
    const trimmed = input.slot.trim();
    const existing = await db.timeSlot.findUnique({ where: { slot: trimmed } });
    if (existing) {
      throw ApiError.conflict('Time slot already exists');
    }

    return await db.timeSlot.create({
      data: { slot: trimmed, isActive: true },
    });
  }

  async toggleTimeSlot(id: string, input: ToggleTimeSlotInput) {
    const existing = await db.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Time slot not found');
    }

    return await db.timeSlot.update({
      where: { id },
      data: { isActive: input.isActive },
    });
  }

  async deleteTimeSlot(id: string) {
    const existing = await db.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound('Time slot not found');
    }

    return await db.timeSlot.delete({
      where: { id },
    });
  }

  async listConfigs() {
    return await db.systemConfig.findMany();
  }

  async updateConfig(input: UpdateConfigInput) {
    return await db.systemConfig.upsert({
      where: { key: input.key },
      update: { value: input.value },
      create: { key: input.key, value: input.value },
    });
  }
}

export const settingsService = new SettingsService();
