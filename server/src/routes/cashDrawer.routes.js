import { Router } from 'express';
import * as cashDrawerController from '../controllers/cashDrawer.controller.js';
import {
  openCashDrawerSchema,
  closeCashDrawerSchema,
} from '../validators/cashDrawer.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const cashierOnly = [requireAuth, requireRole(ROLES.CASHIER)];

// Open cash drawer (needs sync first)
router.post(
  '/open',
  ...cashierOnly,
  requireSync,
  validate(openCashDrawerSchema),
  cashDrawerController.open
);

// Current open cash drawer
router.get('/current', ...cashierOnly, cashDrawerController.current);

// Expected cash breakdown
router.get('/expected', ...cashierOnly, cashDrawerController.expected);

// Close cash drawer (end of day / switch user / logout)
router.post(
  '/close',
  ...cashierOnly,
  validate(closeCashDrawerSchema),
  cashDrawerController.close
);

export default router;
