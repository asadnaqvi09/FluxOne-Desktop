import { z } from 'zod';

// Login
export const loginSchema = z.object({
  userId: z
    .string({ error: 'userId is required' })
    .trim()
    .min(1, 'userId is required'),
  password: z
    .string({ error: 'password is required' })
    .min(1, 'password is required'),
});

// Unlock — password only (PIN removed)
export const unlockSchema = z.object({
  method: z.literal('password').optional().default('password'),
  value: z
    .string({ error: 'value is required' })
    .min(1, 'value is required'),
});

// Self profile — name and/or email
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z
      .union([z.string().trim().email('Invalid email'), z.literal('')])
      .nullable()
      .optional(),
  })
  .refine((b) => b.name !== undefined || b.email !== undefined, {
    message: 'name or email is required',
  });
