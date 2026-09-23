import { Router } from 'express';
import * as setupController from '../controllers/setup.controller.js';
import {
  bootstrapSchema,
  configureSchema,
  setupLoginSchema,
} from '../validators/setup.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { authLimiter } from '../shared/middlewares/rateLimit.middleware.js';

const router = Router();

// First-boot provisioning — no local JWT required
router.get('/status', setupController.status);
router.post('/configure', authLimiter, validate(configureSchema), setupController.configure);
router.post('/login', authLimiter, validate(setupLoginSchema), setupController.login);
router.post('/bootstrap', authLimiter, validate(bootstrapSchema), setupController.bootstrap);

export default router;
