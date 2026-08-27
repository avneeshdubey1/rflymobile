import { z } from 'zod';
import { fetchApi } from './client';

const UserListSchema = z.object({
  success: z.literal(true),
  users: z.array(z.object({
    id: z.string().uuid(), name: z.string(), email: z.string().email(), role: z.string(), active: z.boolean(),
  }).passthrough()),
});

const DroneListSchema = z.object({
  success: z.literal(true),
  drones: z.array(z.object({
    id: z.string().uuid(), status: z.string(), operatingCenterId: z.string().uuid().nullable().optional(),
  }).passthrough()),
});

const RegionListSchema = z.object({
  success: z.literal(true),
  centers: z.array(z.object({
    id: z.string().uuid(), name: z.string(), latitude: z.number(), longitude: z.number(), radiusKm: z.number(), active: z.boolean(),
  }).passthrough()),
});

const PolicySchema = z.object({
  success: z.literal(true),
  policy: z.object({
    enabled: z.boolean(), searchHorizonDays: z.number().int(), workingDayStartMinutes: z.number().int(),
    workingDayEndMinutes: z.number().int(), maxJobsPerUnitPerDay: z.number().int(), revision: z.number().int().positive(),
  }).passthrough(),
});

const MasterDataSchema = z.object({
  success: z.literal(true),
  data: z.object({
    clusters: z.array(z.object({
      id: z.string().uuid(), code: z.string(), displayName: z.string(), type: z.string(), active: z.boolean(),
    }).passthrough()),
    values: z.array(z.object({
      id: z.string().uuid(), category: z.string(), code: z.string(), displayName: z.string(), active: z.boolean(),
    }).passthrough()),
    crops: z.array(z.object({
      id: z.string().uuid(), code: z.string(), displayName: z.string(), active: z.boolean(),
    }).passthrough()),
  }),
});

// Mutating Admin controls remain absent until mobile-specific confirmation,
// validation, conflict and audit contracts exist.
export const adminApi = {
  getUsers: () => fetchApi('/api/mobile/v1/operations/admin/users', {}, UserListSchema),
  getDrones: () => fetchApi('/api/mobile/v1/operations/admin/drones', {}, DroneListSchema),
  getRegions: () => fetchApi('/api/mobile/v1/operations/admin/regions', {}, RegionListSchema),
  getPolicies: () => fetchApi('/api/mobile/v1/operations/admin/policies', {}, PolicySchema),
  getMasterData: () => fetchApi('/api/mobile/v1/operations/admin/master-data', {}, MasterDataSchema),
};
