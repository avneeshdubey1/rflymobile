import { db } from '../../config/db.js';

export class PilotsService {
  async listPilots() {
    return await db.user.findMany({
      where: { role: 'Pilot', isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getPilotById(id: string) {
    return await db.user.findUnique({
      where: { id, role: 'Pilot' },
    });
  }
}

export const pilotsService = new PilotsService();
