import { Router } from 'express';
import * as syncController from '../controllers/sync.controller.js';
import { ROLES } from '../config/constants.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';

const router = Router();

// Status — works offline (meta + outbox counts)
router.get('/status', requireAuth, syncController.status);

// Sync cycle or first bootstrap — online preferred; offline OK after bootstrap
router.post('/', requireAuth, syncController.sync);

// Manual re-bootstrap (admin only)
router.post(
  '/bootstrap',
  requireAuth,
  requireRole(ROLES.ADMIN),
  syncController.bootstrap
);

export default router;
