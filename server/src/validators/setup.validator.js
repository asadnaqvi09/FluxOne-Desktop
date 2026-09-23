import { z } from 'zod';

export const configureSchema = z.object({
  cloudApiUrl: z
    .string({ error: 'cloudApiUrl is required' })
    .trim()
    .min(1, 'cloudApiUrl is required')
    .refine((value) => /^https?:\/\//i.test(value), {
      message: 'cloudApiUrl must start with http:// or https://',
    }),
});

export const setupLoginSchema = z.object({
  id: z.string({ error: 'id is required' }).trim().min(1, 'id is required'),
  password: z
    .string({ error: 'password is required' })
    .min(1, 'password is required'),
});

export const bootstrapSchema = z.object({
  branchId: z.string().trim().min(1).optional(),
});
