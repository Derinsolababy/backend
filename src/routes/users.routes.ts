import { Router } from 'express';
import * as auth from '@/controllers/auth.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateBody } from '@/middleware/validate.middleware';
import { asyncHandler } from '@/utils/helpers';
import { createStaffSchema, updateRoleSchema } from '@/validation/auth.validation';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(auth.listStaff));
router.post('/', validateBody(createStaffSchema), asyncHandler(auth.createStaff));
router.patch('/:id/role', validateBody(updateRoleSchema), asyncHandler(auth.updateStaffRole));

export default router;
