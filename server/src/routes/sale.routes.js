import { Router } from 'express';
import * as saleController from '../controllers/sale.controller.js';
import {
  addItemSchema,
  updateItemSchema,
  checkoutSchema,
} from '../validators/sale.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireUnlocked, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const cashierPos = [requireAuth, requireRole(ROLES.CASHIER), requireSync, requireUnlocked];

// Sale tabs (open carts — survive lock)
router.get('/tabs', ...cashierPos, saleController.listTabs);
router.post('/tabs', ...cashierPos, saleController.createTab);
router.delete('/tabs/:id', ...cashierPos, saleController.deleteTab);

// Cart lines
router.post(
  '/tabs/:id/items',
  ...cashierPos,
  validate(addItemSchema),
  saleController.addItem
);
router.patch(
  '/tabs/:id/items/:lineId',
  ...cashierPos,
  validate(updateItemSchema),
  saleController.updateItem
);
router.delete(
  '/tabs/:id/items/:lineId',
  ...cashierPos,
  saleController.removeItem
);

// Bill totals
router.get('/tabs/:id/totals', ...cashierPos, saleController.totals);

// Checkout (Phase 1.7)
router.post(
  '/tabs/:id/checkout',
  ...cashierPos,
  validate(checkoutSchema),
  saleController.checkout
);

export default router;
