import type { ServiceRequest } from '@prisma/client';

export type RequestWithAssignment = ServiceRequest & {
  assignment?: {
    pilotId: string;
    pilotName: string;
    assignedAt: string;
    acceptedAt: string | null;
  } | null;
};
