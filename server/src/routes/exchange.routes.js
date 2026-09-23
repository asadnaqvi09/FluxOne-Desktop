import { Router } from 'express';
import * as exchangeController from '../controllers/exchange.controller.js';
import { startExchangeSchema } from '../validators/exchange.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireUnlocked, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const cashierInvoice = [requireAuth, requireRole(ROLES.CASHIER), requireSync, requireUnlocked];

// POST /api/invoices/:id/exchange/start { itemIds }
router.post(
  '/:id/exchange/start',
  ...cashierInvoice,
  validate(startExchangeSchema),
  exchangeController.start
);

// GET /api/invoices/:id/exchanges — previous exchange items
router.get(
  '/:id/exchanges',
  ...cashierInvoice,
  exchangeController.listByInvoice
);

export default router;
