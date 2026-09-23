import { Router } from 'express';
import * as auditController from '../controllers/audit.controller.js';
import { logsQuerySchema } from '../validators/admin.validator.js';
import { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.get(
  '/logs',
  requireAuth,
  requireRole(ROLES.ADMIN),
  validateQuery(logsQuerySchema),
  auditController.list
);

export default router;
