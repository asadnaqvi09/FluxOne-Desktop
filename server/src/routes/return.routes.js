import { Router } from 'express';
import * as returnController from '../controllers/return.controller.js';
import { returnSchema } from '../validators/return.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireUnlocked, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const cashierInvoice = [requireAuth, requireRole(ROLES.CASHIER), requireSync, requireUnlocked];

// POST /api/invoices/:id/return { itemIds }  — itemIds = invoice_items.id
router.post(
  '/:id/return',
  ...cashierInvoice,
  validate(returnSchema),
  returnController.create
);

export default router;
