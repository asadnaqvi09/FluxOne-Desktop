import { v4 as uuid } from 'uuid';
import {
  ACTIVITY_ACTION,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_SOURCE,
} from '../config/constants.js';
import { success, error } from '../shared/utils/response.js';
import { withTaxes } from '../shared/utils/admin.util.js';
import * as adminModel from '../models/admin.model.js';
import * as employeeModel from '../models/employee.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as outboxHooks from '../modules/sync/outboxHooks.js';

// GET /api/admin/products
export function listProducts(req, res) {
  try {
    const q = req.validatedQuery || {};
    const result = adminModel.listProducts({
      categoryId: q.category || null,
      subcategoryId: q.subcategory || null,
      q: q.q || null,
      page: q.page,
      pageSize: q.pageSize,
    });
    return success(res, result);
  } catch (err) {
    return error(res, err.message || 'Failed to list products', err.statusCode || 500, err.code || null);
  }
}

// GET /api/admin/products/:id
export function getProduct(req, res) {
  try {
    const product = adminModel.findProduct(req.params.id);
    if (!product) return error(res, 'Product not found', 404);
    return success(res, {
      product: withTaxes(product, adminModel.getProductTaxes),
      taxRules: adminModel.listTaxRules(),
    });
  } catch (err) {
    return error(res, err.message || 'Failed to load product', err.statusCode || 500, err.code || null);
  }
}

// PATCH /api/admin/products/:id — price / discount / taxes
export function updateProduct(req, res) {
  try {
    const existing = adminModel.findProduct(req.params.id);
    if (!existing) return error(res, 'Product not found', 404);

    const { price, discount, taxRuleIds, taxRates } = req.body;

    let resolvedTaxRuleIds;
    if (taxRates !== undefined) {
      resolvedTaxRuleIds = adminModel.resolveTaxRuleIdsFromRates(taxRates);
    } else if (taxRuleIds !== undefined) {
      for (const taxId of taxRuleIds) {
        if (!adminModel.findTaxRule(taxId)) {
          return error(res, `Tax rule not found: ${taxId}`, 400);
        }
      }
      resolvedTaxRuleIds = taxRuleIds;
    }

    const product = adminModel.runTx(() => {
      const updated = adminModel.updateProduct({
        id: existing.id,
        price,
        discount,
      });
      if (resolvedTaxRuleIds !== undefined) {
        adminModel.replaceProductTaxes(existing.id, resolvedTaxRuleIds);
      }
      adminModel.insertActivity({
        id: uuid(),
        employeeId: req.auth.employeeId,
        action: ACTIVITY_ACTION.PRICE_CHANGE,
        entityType: 'product',
        entityId: existing.id,
        details: JSON.stringify({
          sku: existing.sku,
          name: existing.name,
          price: price ?? updated.price,
          discount: discount ?? updated.discount,
          taxRuleIds: resolvedTaxRuleIds ?? null,
          taxRates: taxRates ?? null,
        }),
      });
      const nextPrice = price ?? updated.price;
      const nextDiscount = discount ?? updated.discount;
      if (price !== undefined || discount !== undefined) {
        outboxHooks.queueProductPriceUpdate({
          productId: existing.id,
          sellingPrice: nextPrice,
          discountPercent: nextDiscount,
          updatedByUserId: req.auth.employeeId,
        });
      }
      outboxHooks.queueCashierLog({
        action: ACTIVITY_ACTION.PRICE_CHANGE,
        employeeId: req.auth.employeeId,
        actorUserId: req.auth.userId ?? null,
        actorRole: req.auth.role ?? null,
        entityType: 'product',
        entityId: existing.id,
        details: JSON.stringify({
          sku: existing.sku,
          name: existing.name,
          price: nextPrice,
          discount: nextDiscount,
          taxRuleIds: resolvedTaxRuleIds ?? null,
          taxRates: taxRates ?? null,
        }),
      });
      const body = `Admin: ${existing.name} price/discount updated`;
      for (const cashier of employeeModel.listActiveCashiers()) {
        notificationModel.insert({
          id: uuid(),
          employeeId: cashier.id,
          source: NOTIFICATION_SOURCE.ADMIN,
          audience: NOTIFICATION_AUDIENCE.CASHIER,
          title: 'Price update',
          body,
        });
      }
      return withTaxes(adminModel.findProduct(existing.id), adminModel.getProductTaxes);
    });

    return success(res, { product });
  } catch (err) {
    return error(res, err.message || 'Failed to update product', err.statusCode || 500, err.code || null);
  }
}
