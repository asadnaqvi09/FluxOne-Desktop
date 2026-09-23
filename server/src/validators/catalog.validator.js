import { z } from 'zod';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

// Product list query
export const listProductsQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  subcategory: z.string().trim().min(1).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  popular: z
    .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});
