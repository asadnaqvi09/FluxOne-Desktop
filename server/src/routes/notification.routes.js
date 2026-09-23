import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { listNotificationsQuerySchema } from '../validators/notification.validator.js';
import { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth } from '../shared/middlewares/auth.middleware.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  validateQuery(listNotificationsQuerySchema),
  notificationController.list
);
router.post('/:id/read', requireAuth, notificationController.markRead);
router.delete('/', requireAuth, notificationController.clear);

export default router;
