import { z } from 'zod';

const emptyToUndef = (value) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

const dateSchema = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional()
);

export const logsQuerySchema = z.object({
  date: dateSchema,
  from: dateSchema,
  to: dateSchema,
});

export const listAdminProductsQuerySchema = z.object({
  category: z.preprocess(emptyToUndef, z.string().trim().min(1).optional()),
  subcategory: z.preprocess(emptyToUndef, z.string().trim().min(1).optional()),
  q: z.preprocess(emptyToUndef, z.string().trim().min(1).optional()),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export const employeesQuerySchema = z.object({
  role: z.preprocess(
    emptyToUndef,
    z.enum(['cashier', 'admin']).optional()
  ),
});

export const assignCashierSchema = z.object({
  employeeId: z.string().trim().min(1, 'employeeId is required'),
});

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    pictureUrl: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (b) =>
      b.name !== undefined ||
      b.userId !== undefined ||
      b.pictureUrl !== undefined ||
      b.isActive !== undefined,
    { message: 'At least one employee field is required' }
  );

export const updateProductSchema = z
  .object({
    price: z.coerce.number().finite().nonnegative().optional(),
    discount: z.coerce.number().finite().nonnegative().optional(),
    taxRuleIds: z.array(z.string().trim().min(1)).optional(),
    taxRates: z
      .array(z.coerce.number().finite().min(0).max(100))
      .max(2)
      .optional(),
  })
  .refine(
    (b) =>
      b.price !== undefined ||
      b.discount !== undefined ||
      b.taxRuleIds !== undefined ||
      b.taxRates !== undefined,
    { message: 'price, discount, taxRuleIds, or taxRates is required' }
  );

export const updateStoreProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    contactPhone: z.string().trim().optional(),
    contactEmail: z.string().trim().optional(),
    address: z.string().trim().optional(),
    warningMessage: z.string().trim().optional(),
    returnInstructions: z.string().trim().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'At least one store profile field is required',
  });

export default {
  assignCashier: assignCashierSchema,
  updateEmployee: updateEmployeeSchema,
  updateProduct: updateProductSchema,
  updateStoreProfile: updateStoreProfileSchema,
};
