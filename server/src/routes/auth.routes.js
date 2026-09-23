import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { loginSchema, unlockSchema, updateProfileSchema } from '../validators/auth.validator.js';
import validate from '../shared/middlewares/validate.middleware.js';
import { requireAuth } from '../shared/middlewares/auth.middleware.js';
import { authLimiter } from '../shared/middlewares/rateLimit.middleware.js';

const router = Router();

// Login / unlock — stricter rate limit against password guessing
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), authController.updateMe);
router.post('/lock', requireAuth, authController.lock);
router.post('/unlock', authLimiter, requireAuth, validate(unlockSchema), authController.unlock);

export default router;
