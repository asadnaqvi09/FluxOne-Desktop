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

const timeSchema = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time must be HH:MM or HH:MM:SS')
    .optional()
);

const qSchema = z.preprocess(emptyToUndef, z.string().trim().min(1).optional());

// List filters: date, time-to-time, invoice id search
export const listInvoicesQuerySchema = z.object({
  date: dateSchema,
  timeFrom: timeSchema,
  timeTo: timeSchema,
  q: qSchema,
});
