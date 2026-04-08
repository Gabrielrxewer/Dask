import { z } from 'zod';

export const registerDto = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8)
});

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createOrganizationDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).optional()
});
