import { z } from 'zod';

// Open cash drawer (opening float = starting cash in drawer)
export const openCashDrawerSchema = z.object({
  openingFloat: z.coerce.number().finite().nonnegative('openingFloat must be >= 0'),
});

// Close cash drawer (end-of-day / switch user / logout cash count)
export const closeCashDrawerSchema = z.object({
  countedCash: z.coerce.number().finite().nonnegative('countedCash must be >= 0'),
  remarks: z.string().trim().optional(),
  managerPassword: z.string().trim().optional(),
  supervisorPin: z.string().trim().optional(),
});
