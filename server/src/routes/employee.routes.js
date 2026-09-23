import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import { assignCashierSchema, employeesQuerySchema, updateEmployeeSchema } from '../validators/admin.validator.js';
import validate, { validateQuery } from '../shared/middlewares/validate.middleware.js';
import { requireAuth, requireRole } from '../shared/middlewares/auth.middleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(ROLES.ADMIN)];

router.get(
  '/employees',
  ...adminOnly,
  validateQuery(employeesQuerySchema),
  employeeController.list
);
router.patch(
  '/employees/:id',
  ...adminOnly,
  validate(updateEmployeeSchema),
  employeeController.update
);
router.get('/cashiers/current', ...adminOnly, employeeController.currentCashier);
router.post(
  '/cashiers/assign',
  ...adminOnly,
  validate(assignCashierSchema),
  employeeController.assignCashier
);

export default router;
