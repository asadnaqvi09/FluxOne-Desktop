import { z } from 'zod';
import { NOTIFICATION_SOURCE } from '../config/constants.js';

const emptyToUndef = (value) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

export const listNotificationsQuerySchema = z.object({
  source: z.preprocess(
    emptyToUndef,
    z.enum([NOTIFICATION_SOURCE.SYSTEM, NOTIFICATION_SOURCE.ADMIN]).optional()
  ),
});
