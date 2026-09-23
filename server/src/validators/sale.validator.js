import { z } from 'zod';

// Add line — sku or productId, qty default 1
export const addItemSchema = z
  .object({
    sku: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    qty: z.coerce.number().int().nonnegative().default(1),
  })
  .refine((b) => Boolean(b.sku || b.productId), {
    message: 'sku or productId is required',
  });

// Update line qty (0 allowed — FE confirms remove)
export const updateItemSchema = z.object({
  qty: z.coerce.number().int().nonnegative('qty must be >= 0'),
});

// Checkout (cash) — sale or exchange tab
export const checkoutSchema = z.object({
  tendered: z.coerce.number().finite().nonnegative('tendered must be >= 0'),
});
