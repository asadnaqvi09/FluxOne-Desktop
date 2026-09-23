/**
 * Cash Drawer Session controller
 * Auth logs you in; Cash Drawer tracks the physical cash for one shift.
 */
import { v4 as uuid } from 'uuid';
import config from '../config/index.js';
import {
  ACTIVITY_ACTION,
  CASH_MOVEMENT_TYPE,
  ERROR_CODE,
  NOTIFICATION_SOURCE,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import {
  money,
  publicDrawer,
  nextDrawerId,
} from '../shared/utils/cashDrawer.util.js';
import * as cashDrawerModel from '../models/cashDrawer.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';

// Open cash drawer (start shift with opening float)
export function open(req, res) {
  try {
    const existing = cashDrawerModel.findOpenCashDrawer(req.auth.employeeId);
    if (existing) {
      return error(res, 'Cash drawer already open', 409, ERROR_CODE.CASH_DRAWER_OPEN);
    }
    const openingFloat = money(req.body.openingFloat);
    const data = cashDrawerModel.runTx(() => {
      const id = nextDrawerId();
      const drawer = cashDrawerModel.createCashDrawer({
        id,
        employeeId: req.auth.employeeId,
        authSessionId: req.auth.sessionId,
        openingFloat,
      });
      cashDrawerModel.addCashMovement({
        id: uuid(),
        cashDrawerId: id,
        type: CASH_MOVEMENT_TYPE.OPENING,
        amount: openingFloat,
      });
      const tab = cashDrawerModel.createEmptySaleTab({
        id: uuid(),
        cashDrawerId: id,
        employeeId: req.auth.employeeId,
        authSessionId: req.auth.sessionId,
      });
      cashDrawerModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.OPEN_CASH_DRAWER,
        entityType: 'cash_drawer',
        entityId: id,
        details: JSON.stringify({ openingFloat }),
      });
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.OPEN_CASH_DRAWER,
        employeeId: req.auth.employeeId,
        actorUserId: req.auth.userId ?? null,
        actorRole: req.auth.role ?? null,
        entityType: 'cash_drawer',
        entityId: id,
        details: JSON.stringify({ openingFloat }),
      });
      cashDrawerModel.createNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Cash drawer opened',
        body: `Opening float Rs. ${openingFloat.toFixed(2)}. Session ${id}.`,
      });
      return { cashDrawer: publicDrawer(drawer), saleTab: tab };
    });
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message || 'Failed to open cash drawer', err.statusCode || 500, err.code || null);
  }
}

// Current open cash drawer
export function current(req, res) {
  try {
    const drawer = cashDrawerModel.findOpenCashDrawer(req.auth.employeeId);
    return success(res, { cashDrawer: publicDrawer(drawer) });
  } catch (err) {
    return error(res, err.message || 'Failed to load cash drawer', 500);
  }
}

// Expected drawer cash = opening float + sales − refunds
export function expected(req, res) {
  try {
    const drawer = cashDrawerModel.findOpenCashDrawer(req.auth.employeeId);
    if (!drawer) {
      return error(res, 'No open cash drawer', 404, ERROR_CODE.CASH_DRAWER_CLOSED);
    }
    const breakdown = cashDrawerModel.getExpectedCash(drawer.id, drawer.openingFloat);
    return success(res, {
      cashDrawerId: drawer.id,
      ...breakdown,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to compute expected cash', 500);
  }
}

// Close cash drawer (cash count + variance; Branch Manager password if |variance| > threshold)
export function close(req, res) {
  try {
    const drawer = cashDrawerModel.findOpenCashDrawer(req.auth.employeeId);
    if (!drawer) {
      return error(res, 'No open cash drawer', 404, ERROR_CODE.CASH_DRAWER_CLOSED);
    }
    if (cashDrawerModel.hasOpenCartsWithItems(drawer.id)) {
      return error(res, 'Close or empty open sale carts before closing cash drawer', 409, ERROR_CODE.CARTS_NOT_EMPTY);
    }
    const countedCash = money(req.body.countedCash);
    const breakdown = cashDrawerModel.getExpectedCash(drawer.id, drawer.openingFloat);
    const expectedCash = breakdown.expectedCash;
    const variance = money(countedCash - expectedCash);
    const remarks = req.body.remarks?.trim() || '';
    if (variance !== 0 && !remarks) {
      return error(res, 'Remarks required when variance is not zero', 400, ERROR_CODE.REMARKS_REQUIRED);
    }
    if (Math.abs(variance) > config.variancePinThreshold) {
      const managerPassword = req.body.managerPassword ?? req.body.supervisorPin;
      if (!managerPassword) {
        return error(
          res,
          `Branch Manager password required when |variance| > ${config.variancePinThreshold}`,
          403,
          ERROR_CODE.VARIANCE_PIN_REQUIRED
        );
      }
      if (!cashDrawerModel.verifyBranchManagerPassword(managerPassword)) {
        return error(res, 'Invalid Branch Manager password', 401);
      }
    }
    const closed = cashDrawerModel.runTx(() => {
      const row = cashDrawerModel.closeCashDrawer({
        id: drawer.id,
        countedCash,
        expectedCash,
        variance,
        remarks: remarks || null,
      });
      cashDrawerModel.logActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.CLOSE_CASH_DRAWER,
        entityType: 'cash_drawer',
        entityId: drawer.id,
        details: JSON.stringify({ countedCash, expectedCash, variance }),
      });
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.CLOSE_CASH_DRAWER,
        employeeId: req.auth.employeeId,
        actorUserId: req.auth.userId ?? null,
        actorRole: req.auth.role ?? null,
        entityType: 'cash_drawer',
        entityId: drawer.id,
        details: JSON.stringify({ countedCash, expectedCash, variance }),
      });
      cashDrawerModel.createNotification({
        id: uuid(),
        employeeId: req.auth.employeeId,
        source: NOTIFICATION_SOURCE.SYSTEM,
        title: 'Cash drawer closed',
        body: `Counted Rs. ${countedCash.toFixed(2)}. Variance Rs. ${variance.toFixed(2)}.`,
      });
      return publicDrawer(row);
    });
    return success(res, {
      cashDrawer: closed,
      breakdown: { ...breakdown, countedCash, variance },
    });
  } catch (err) {
    return error(res, err.message || 'Failed to close cash drawer', err.statusCode || 500, err.code || null);
  }
}
