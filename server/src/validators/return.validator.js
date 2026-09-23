import { z } from 'zod';

// itemIds = invoice_items.id (not list indexes — stable if the table is re-sorted)
export const returnSchema = z.object({
  itemIds: z
    .array(z.string().trim().min(1), { error: 'itemIds is required' })
    .min(1, 'Select at least one line to return'),
});
