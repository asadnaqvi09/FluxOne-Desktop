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

function withTaxesList(products = []) {
  const taxMap = catalogModel.getTaxesForProducts(products.map((p) => p.id));
  return products.map((p) => ({
    ...p,
    taxes: taxMap.get(p.id) || [],
  }));
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
    const items = withTaxesList(result.items);
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

    // Variant parent barcode → option picker (never sell parent)
    if (product.isVariantParent || product.productType === 'variant') {
      const children = withTaxesList(catalogModel.listChildren(product.id));
      return success(res, {
        needsVariantPick: true,
        product: withTaxes(product),
        children,
      });
    }

    if (Number(product.stock) <= 0) {
      return error(res, stockOutMessage(0), 409, ERROR_CODE.INSUFFICIENT_STOCK);
    }
    return success(res, { product: withTaxes(product), needsVariantPick: false });
  } catch (err) {
    return error(res, err.message || 'Failed to find product', 500);
  }
}

/** GET /products/:id/children — sellable variant SKUs under a parent */
export function listChildren(req, res) {
  try {
    const parentId = String(req.params.id || '').trim();
    if (!parentId) return error(res, 'Product id is required', 400);
    const parent = catalogModel.findProductById(parentId);
    if (!parent) return error(res, 'Product not found', 404);
    if (!parent.isVariantParent && parent.productType !== 'variant') {
      return success(res, { parent: withTaxes(parent), children: [] });
    }
    const children = withTaxesList(catalogModel.listChildren(parentId));
    return success(res, {
      needsVariantPick: true,
      parent: withTaxes(parent),
      children,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to list variant children', 500);
  }
}
