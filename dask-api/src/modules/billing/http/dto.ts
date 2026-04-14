import { z } from 'zod';

export const createCheckoutSessionDto = z.object({
  planCode: z.enum(['PERSONAL', 'BUSINESS'])
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionDto>;
