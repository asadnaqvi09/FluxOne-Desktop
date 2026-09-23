import { Router } from 'express';
import * as storeController from '../controllers/store.controller.js';
import { updateStoreProfileSchema } from '../validators/admin.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get('/store-profile', ...adminOnly, storeController.get);
router.patch(
  '/store-profile',
  ...adminOnly,
  validate(updateStoreProfileSchema),
  storeController.update
);

export default router;
