import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import {
  listAdminProductsQuerySchema,
  updateProductSchema,
} from '../validators/admin.validator.js';
import validate, { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { ROLES } from '../config/constants.js';
import auditRoutes from './audit.routes.js';
import employeeRoutes from './employee.routes.js';
import storeRoutes from './store.routes.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.use(auditRoutes);
router.use(employeeRoutes);
router.use(storeRoutes);

router.get(
  '/products',
  ...adminOnly,
  validateQuery(listAdminProductsQuerySchema),
  adminController.listProducts
);
router.get('/products/:id', ...adminOnly, adminController.getProduct);
router.patch(
  '/products/:id',
  ...adminOnly,
  validate(updateProductSchema),
  adminController.updateProduct
);

export default router;
