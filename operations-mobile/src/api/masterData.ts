import { z } from 'zod';
import { fetchApi } from './client';

export const ChoiceSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  displayName: z.string(),
});

export const MasterChoicesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    requestTypes: z.array(z.enum(['B2B', 'B2C'])),
    clusterTypes: z.array(z.enum(['CLUSTER', 'HUB', 'SPOKE', 'MINIHUB'])),
    clusters: z.array(ChoiceSchema.extend({ type: z.string() })),
    crops: z.array(ChoiceSchema),
    sprayPurposes: z.array(ChoiceSchema),
    b2bSubcategories: z.array(ChoiceSchema),
    b2cClassifications: z.array(ChoiceSchema),
    leadSources: z.array(ChoiceSchema),
    reportingAdmins: z.array(ChoiceSchema),
  }),
});

export type MasterChoice = z.infer<typeof ChoiceSchema>;

export const masterDataApi = {
  getChoices: () => fetchApi(
    '/api/mobile/v1/operations/master-data/choices',
    {},
    MasterChoicesResponseSchema,
    { dataset: 'masterChoices', key: 'active' },
  ),
};
