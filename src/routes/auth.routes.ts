import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '@/config/config';
import * as auth from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateBody } from '@/middleware/validate.middleware';
import { asyncHandler } from '@/utils/helpers';
import { loginSchema, registerSchema, updateProfileSchema } from '@/validation/auth.validation';

const router = Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later' },
});

router.post(
  '/register',
  credentialLimiter,
  validateBody(registerSchema),
  asyncHandler(auth.register),
);
router.post('/login', credentialLimiter, validateBody(loginSchema), asyncHandler(auth.login));
router.get('/me', authenticate, asyncHandler(auth.me));
router.patch('/me', authenticate, validateBody(updateProfileSchema), asyncHandler(auth.updateMe));

export default router;
