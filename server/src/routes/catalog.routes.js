import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller.js';
import { listProductsQuerySchema } from '../validators/catalog.validator.js';
import { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { requireSync } from '../shared/middlewares/sync.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const cashierOnly = [requireAuth, requireRole(ROLES.CASHIER)];

// Categories
router.get('/categories', ...cashierOnly, requireSync, catalogController.listCategories);

// Products (Most Used / drill-down / search)
router.get(
  '/products',
  ...cashierOnly,
  requireSync,
  validateQuery(listProductsQuerySchema),
  catalogController.listProducts
);

// Scanner / Enter — exact SKU or barcode
router.get('/products/sku/:sku', ...cashierOnly, requireSync, catalogController.getBySku);

export default router;
