import { v4 as uuid } from 'uuid';
import {
  ACTIVITY_ACTION,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_SOURCE,
  ROLES,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { publicEmployee } from '../shared/utils/auth.util.js';
import * as employeeModel from '../models/employee.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as authModel from '../models/auth.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';

// GET /api/admin/employees?role=cashier
export function list(req, res) {
  try {
    const role = req.validatedQuery?.role;
    const employees = employeeModel.listEmployees(role).map(publicEmployee);
    return success(res, { employees });
  } catch (err) {
    return error(res, err.message || 'Failed to list employees', err.statusCode || 500, err.code || null);
  }
}

// GET /api/admin/cashiers/current
export function currentCashier(req, res) {
  try {
    const current = employeeModel.getCurrentCashier();
    if (!current) return error(res, 'No cashier assigned', 404);
    return success(res, {
      cashier: {
        ...publicEmployee(current),
        assignedAt: current.assignedAt,
        assignedBy: current.assignedBy,
        assignedByName: current.assignedByName,
      },
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load current cashier', err.statusCode || 500, err.code || null);
  }
}

// PATCH /api/admin/employees/:id — { name?, userId?, pictureUrl?, isActive? }
export function update(req, res) {
  try {
    const employee = employeeModel.findEmployeeById(req.params.id);
    if (!employee) return error(res, 'Employee not found', 404);
    if (employee.role !== ROLES.CASHIER) {
      return error(res, 'Only cashier employees can be edited here', 400);
    }

    const updated = employeeModel.updateEmployee(req.params.id, req.body || {});
    return success(res, { employee: publicEmployee(updated) });
  } catch (err) {
    return error(
      res,
      err.message || 'Failed to update employee',
      err.statusCode || 500,
      err.code || null
    );
  }
}

// POST /api/admin/cashiers/assign { employeeId }
export function assignCashier(req, res) {
  try {
    const employee = employeeModel.findEmployeeById(req.body.employeeId);
    if (!employee) return error(res, 'Employee not found', 404);
    if (employee.role !== ROLES.CASHIER) return error(res, 'Employee is not a cashier', 400);
    if (!employee.isActive) return error(res, 'Employee is inactive', 400);

    const cashier = employeeModel.runTx(() => {
      const assigned = employeeModel.assignCashier({
        employeeId: employee.id,
        assignedBy: req.auth.employeeId,
      });
      const changeDetails = {
        cashierId: employee.id,
        cashierUserId: employee.userId,
        cashierName: employee.name,
      };
      authModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.CHANGE_CASHIER,
        entityType: 'employee',
        entityId: employee.id,
        details: JSON.stringify(changeDetails),
      });
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.CHANGE_CASHIER,
        employeeId: req.auth.employeeId,
        actorUserId: req.auth.userId ?? null,
        actorRole: req.auth.role ?? null,
        entityType: 'employee',
        entityId: employee.id,
        details: JSON.stringify(changeDetails),
      });
      const title = 'Assigned cashier';
      const body = `Admin assigned ${employee.name} (${employee.id}) as current cashier.`;
      for (const target of employeeModel.listActiveCashiers()) {
        notificationModel.insert({
          id: uuid(),
          employeeId: target.id,
          source: NOTIFICATION_SOURCE.ADMIN,
          audience: NOTIFICATION_AUDIENCE.CASHIER,
          title,
          body,
        });
      }
      return assigned;
    });

    return success(res, {
      cashier: {
        ...publicEmployee(cashier),
        assignedAt: cashier.assignedAt,
        assignedBy: cashier.assignedBy,
        assignedByName: cashier.assignedByName,
      },
    });
  } catch (err) {
    return error(res, err.message || 'Failed to assign cashier', err.statusCode || 500, err.code || null);
  }
}
