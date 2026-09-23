import { success, error } from '../shared/utils/response.js';
import { ERROR_CODE } from '../config/constants.js';
import * as catalogModel from '../models/catalog.model.js';
import { stockOutMessage } from '../shared/utils/sale.util.js';

function withTaxes(product) {
  if (!product) return null;
  return {
    ...product,
    taxes: catalogModel.getProductTaxes(product.id),
  };
}

// Categories (Most Used is FE filter via popular=1, not a DB row)
export function listCategories(req, res) {
  try {
    const categories = catalogModel.listCategories();
    return success(res, { categories });
  } catch (err) {
    return error(res, err.message || 'Failed to list categories', 500);
  }
}

// Products — Most Used, drill-down, search, pagination
export function listProducts(req, res) {
  try {
    const q = req.validatedQuery;
    const categoryId = q.category || null;
    const subcategoryId = q.subcategory || null;

    if (categoryId && !subcategoryId && !q.popular && !q.q) {
      const category = catalogModel.findCategory(categoryId);
      if (!category) return error(res, 'Category not found', 404);
      if (category.hasSubcategories) {
        const subcategories = catalogModel.listSubcategories(categoryId);
        return success(res, {
          needsSubcategory: true,
          category,
          subcategories,
          items: [],
          page: q.page,
          pageSize: q.pageSize,
          total: 0,
        });
      }
    }

    const result = catalogModel.listProducts({
      categoryId,
      subcategoryId,
      q: q.q || null,
      popular: Boolean(q.popular),
      page: q.page,
      pageSize: q.pageSize,
    });
    const taxMap = catalogModel.getTaxesForProducts(result.items.map((p) => p.id));
    const items = result.items.map((p) => ({
      ...p,
      taxes: taxMap.get(p.id) || [],
    }));
    return success(res, {
      needsSubcategory: false,
      items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to list products', 500);
  }
}

// Exact SKU or barcode (scanner / Enter)
export function getBySku(req, res) {
  try {
    const code = String(req.params.sku || '').trim();
    if (!code) return error(res, 'SKU is required', 400);
    const product = catalogModel.findBySkuOrBarcode(code);
    if (!product) return error(res, 'Product not found', 404);
    if (Number(product.stock) <= 0) {
      return error(res, stockOutMessage(0), 409, ERROR_CODE.INSUFFICIENT_STOCK);
    }
    return success(res, { product: withTaxes(product) });
  } catch (err) {
    return error(res, err.message || 'Failed to find product', 500);
  }
}
