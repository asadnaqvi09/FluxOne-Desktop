import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import { listInvoicesQuerySchema } from '../validators/invoice.validator.js';
import { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireUnlocked, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';
import returnRoutes from './return.routes.js';
import exchangeRoutes from './exchange.routes.js';

const router = Router();
const cashierInvoice = [requireAuth, requireRole(ROLES.CASHIER), requireSync, requireUnlocked];

// Invoice list — date, time-to-time, ID search
router.get(
  '/',
  ...cashierInvoice,
  validateQuery(listInvoicesQuerySchema),
  invoiceController.list
);

// Nested: POST /:id/return, POST /:id/exchange/start, GET /:id/exchanges
router.use(returnRoutes);
router.use(exchangeRoutes);

router.get('/:id/print', ...cashierInvoice, invoiceController.print);
router.get('/:id', ...cashierInvoice, invoiceController.getById);

export default router;
