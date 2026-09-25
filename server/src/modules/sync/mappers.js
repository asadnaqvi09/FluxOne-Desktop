import {
  isBcryptPasswordHash,
  resolveCloudPasswordHash,
} from '../../shared/utils/passwordHash.js';

export { isBcryptPasswordHash, resolveCloudPasswordHash };

const SKIP_CLOUD_ROLES = new Set(['inventory_manager', 'b2b_admin']);

const CLOUD_ROLE_TO_POS = Object.freeze({
  branch_manager: 'admin',
  cashier: 'cashier',
});

export function normalizeSnapshot(data = {}) {
  return {
    tenant: data.tenant ?? null,
    branch: data.branch ?? null,
    // Preserve "users key missing" vs "users: []" for deactivate-on-full-list.
    users: Array.isArray(data.users) ? data.users : [],
    usersProvided: Array.isArray(data.users),
    categories: data.categories ?? [],
    products: data.products ?? [],
    taxes: data.taxes ?? [],
    productTaxes: data.productTaxes ?? data.product_taxes ?? [],
    branchInventory: data.branchInventory ?? data.branch_inventory ?? [],
    counters: data.counters ?? data.posCounters ?? data.pos_counters ?? [],
    company: data.company ?? data.companySettings ?? data.settings ?? null,
    offers: data.offers ?? [],
  };
}

export function mapCloudUserToEmployee(user = {}) {
  const roleSlug = String(
    user.role?.slug ?? user.roleSlug ?? user.role_slug ?? user.role ?? ''
  ).toLowerCase();

  if (SKIP_CLOUD_ROLES.has(roleSlug)) {
    return null;
  }

  const posRole = CLOUD_ROLE_TO_POS[roleSlug];
  if (!posRole) {
    return null;
  }

  const passwordHash = resolveCloudPasswordHash(user);
  const name = user.name ?? user.fullName ?? user.full_name ?? null;
  // Contract: loginId → local email / user_id (POS login key)
  const email =
    user.loginId ??
    user.login_id ??
    user.email ??
    user.userId ??
    user.user_id ??
    null;
  if (!user.id || !email || !name) {
    return null;
  }

  return {
    id: user.id,
    userId: email,
    email,
    name,
    role: posRole,
    passwordHash,
    pictureUrl: user.pictureUrl ?? user.picture_url ?? null,
    isActive:
      user.isActive !== undefined
        ? user.isActive
          ? 1
          : 0
        : user.is_active !== undefined
          ? user.is_active
            ? 1
            : 0
          : 1,
  };
}

export function splitCloudCategories(categories = []) {
  const roots = [];
  const children = [];
  const childParentMap = new Map();
  const childCountByRoot = new Map();

  for (const category of categories) {
    const id = category.id;
    const parentId = category.parentId ?? category.parent_id ?? null;
    if (!id) continue;

    if (!parentId) {
      roots.push(category);
      continue;
    }

    children.push(category);
    childParentMap.set(id, parentId);
    childCountByRoot.set(parentId, (childCountByRoot.get(parentId) || 0) + 1);
  }

  return { roots, children, childParentMap, childCountByRoot };
}

export function mapCloudCategoryRow(category, childCountByRoot) {
  const id = category.id;
  const childCount = childCountByRoot.get(id) || 0;
  return {
    id,
    name: category.name,
    hasSubcategories: childCount > 0 ? 1 : 0,
    sortOrder: category.sortOrder ?? category.sort_order ?? 0,
    isActive:
      category.isActive !== undefined
        ? category.isActive
          ? 1
          : 0
        : category.is_active !== undefined
          ? category.is_active
            ? 1
            : 0
          : 1,
  };
}

export function mapCloudSubcategoryRow(category, childParentMap) {
  const id = category.id;
  const categoryId = category.parentId ?? category.parent_id ?? childParentMap.get(id);
  if (!categoryId) return null;

  return {
    id,
    categoryId,
    name: category.name,
    sortOrder: category.sortOrder ?? category.sort_order ?? 0,
    isActive:
      category.isActive !== undefined
        ? category.isActive
          ? 1
          : 0
        : category.is_active !== undefined
          ? category.is_active
            ? 1
            : 0
          : 1,
  };
}

export function buildInventoryMap(branchInventory = []) {
  const map = new Map();
  for (const row of branchInventory) {
    const productId = row.productId ?? row.product_id;
    if (!productId) continue;
    const quantity = Number(row.quantity ?? row.qty ?? 0);
    map.set(productId, Number.isFinite(quantity) ? quantity : 0);
  }
  return map;
}

export function mapCloudTaxRow(tax = {}) {
  if (!tax.id || !tax.name) return null;
  const rate = Number(tax.rate ?? tax.ratePercent ?? tax.rate_percent ?? 0);
  return {
    id: tax.id,
    name: tax.name,
    rate: Number.isFinite(rate) ? rate : 0,
    isActive:
      tax.isActive !== undefined
        ? tax.isActive
          ? 1
          : 0
        : tax.is_active !== undefined
          ? tax.is_active
            ? 1
            : 0
          : 1,
  };
}

export function resolveProductCategoryIds(product, childParentMap) {
  const rawCategoryId = product.categoryId ?? product.category_id ?? null;
  if (!rawCategoryId) {
    return { categoryId: null, subcategoryId: null };
  }

  const parentId = childParentMap.get(rawCategoryId);
  if (parentId) {
    return { categoryId: parentId, subcategoryId: rawCategoryId };
  }

  return {
    categoryId: rawCategoryId,
    subcategoryId: product.subcategoryId ?? product.subcategory_id ?? null,
  };
}

export function mapCloudProductRow(product, { childParentMap, inventoryMap }) {
  if (!product.id || !product.name) return null;

  const { categoryId, subcategoryId } = resolveProductCategoryIds(product, childParentMap);
  if (!categoryId) return null;

  const stockFromInventory = inventoryMap.get(product.id);
  const stock =
    stockFromInventory !== undefined
      ? stockFromInventory
      : Number(product.stock ?? product.quantity ?? 0);

  return {
    id: product.id,
    sku: product.itemCode ?? product.item_code ?? product.sku ?? product.id,
    barcode: product.barcode ?? null,
    name: product.name,
    categoryId,
    subcategoryId,
    price: Number(product.sellingPrice ?? product.selling_price ?? product.price ?? 0),
    discount: Number(
      product.discountPercent ??
        product.discount_percent ??
        product.discount ??
        0
    ),
    stock: Number.isFinite(stock) ? stock : 0,
    isPopular:
      product.isPopular !== undefined
        ? product.isPopular
          ? 1
          : 0
        : product.is_popular !== undefined
          ? product.is_popular
            ? 1
            : 0
          : 0,
    imageUrl: product.imageUrl ?? product.image_url ?? null,
    isActive: resolveEntityIsActive(product),
    taxIds: collectProductTaxIds(product),
  };
}

function resolveEntityIsActive(entity) {
  if (entity.isActive !== undefined) return entity.isActive ? 1 : 0;
  if (entity.is_active !== undefined) return entity.is_active ? 1 : 0;
  if (entity.status !== undefined) return entity.status === 'active' ? 1 : 0;
  return 1;
}

function collectProductTaxIds(product) {
  const ids = new Set();
  const direct = product.taxIds ?? product.tax_ids ?? [];
  for (const taxId of direct) {
    if (taxId) ids.add(taxId);
  }
  const nested = product.taxes ?? [];
  for (const tax of nested) {
    const taxId = tax?.id ?? tax?.taxId ?? tax?.tax_id;
    if (taxId) ids.add(taxId);
  }
  return [...ids];
}

export function mapProductTaxLinks(productTaxes = [], products = []) {
  const links = [];

  for (const row of productTaxes) {
    const productId = row.productId ?? row.product_id;
    const taxRuleId = row.taxId ?? row.tax_id ?? row.taxRuleId ?? row.tax_rule_id;
    if (productId && taxRuleId) {
      links.push({ productId, taxRuleId });
    }
  }

  for (const product of products) {
    const productId = product.id;
    if (!productId) continue;
    for (const taxId of collectProductTaxIds(product)) {
      links.push({ productId, taxRuleId: taxId });
    }
  }

  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.productId}:${link.taxRuleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapCloudCounterRow(counter = {}) {
  if (!counter.id) return null;
  return {
    id: counter.id,
    code: counter.code ?? counter.id,
    name: counter.name ?? counter.code ?? 'Counter',
    isActive:
      counter.isActive !== undefined
        ? counter.isActive
          ? 1
          : 0
        : counter.is_active !== undefined
          ? counter.is_active
            ? 1
            : 0
          : 1,
  };
}

/**
 * First present own-key on `obj` (null/undefined → '').
 * Returns `undefined` when none of the keys exist (caller should not overwrite).
 */
export function pickPresentText(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    if (value == null) return '';
    return String(value);
  }
  return undefined;
}

/**
 * Map cloud company (+ optional branch) → local store_profile.
 * UI "Branch" field is stored in contactEmail (see mapAdmin.js).
 *
 * Footer text (warning / return+policies): when company is in the payload and
 * those keys are present (even as null), map null → '' so sync can clear
 * stale printable policies after Admin turns them off.
 */
export function mapCompanyToStoreProfile(company = {}, branch = null) {
  const hasCompany = company && typeof company === 'object';
  const hasBranch = branch && typeof branch === 'object';
  if (!hasCompany && !hasBranch) return null;

  const companyName = hasCompany ? (company.name ?? null) : null;
  const branchName = hasBranch
    ? (branch.name ?? branch.branchName ?? branch.branch_name ?? null)
    : null;

  const companyPhone = hasCompany
    ? (company.phone ?? company.contactPhone ?? company.contact_phone ?? null)
    : null;
  const branchPhone = hasBranch
    ? (branch.phone ?? branch.contactPhone ?? branch.contact_phone ?? null)
    : null;

  const companyAddress = hasCompany ? (company.address ?? null) : null;
  const branchAddress = hasBranch ? (branch.address ?? null) : null;

  const companyEmail = hasCompany
    ? (company.email ?? company.contactEmail ?? company.contact_email ?? null)
    : null;

  // Prefer explicit keys; if company payload has no footer keys at all, still
  // clear when company is present so policy-off deltas that omit/null fields
  // do not leave COALESCE-stuck policy text on the slip.
  let warningMessage;
  let returnInstructions;
  if (hasCompany) {
    warningMessage = pickPresentText(company, [
      'warningMessage',
      'warning_message',
      'warning',
    ]);
    returnInstructions = pickPresentText(company, [
      'returnPolicy',
      'return_policy',
      'returnInstructions',
      'return_instructions',
    ]);
    if (warningMessage === undefined) warningMessage = '';
    if (returnInstructions === undefined) returnInstructions = '';
  }

  return {
    name: companyName || branchName || null,
    // POS Invoice Details "Branch" ↔ contactEmail
    contactEmail: branchName || companyEmail || null,
    contactPhone: companyPhone || branchPhone || null,
    address: companyAddress || branchAddress || null,
    // undefined = branch-only delta → keep local footer (see applyStoreProfile)
    warningMessage,
    returnInstructions,
    shopOpenTime: hasCompany
      ? (company.openTime ?? company.open_time ?? company.shopOpenTime ?? null)
      : null,
    shopCloseTime: hasCompany
      ? (company.closeTime ?? company.close_time ?? company.shopCloseTime ?? null)
      : null,
    currency: hasCompany ? (company.currency ?? null) : null,
    applyFooterText: hasCompany,
  };
}

export function eventClientIds(items = []) {
  return items
    .map((item) => {
      if (typeof item === 'string') return item;
      return item.clientEventId ?? item.client_event_id ?? null;
    })
    .filter(Boolean);
}

export function collectAcceptedEventIds(pushResult = {}) {
  const ids = new Set(eventClientIds(pushResult.accepted));
  for (const row of pushResult.raw?.events ?? pushResult.events ?? []) {
    const clientEventId = row?.clientEventId ?? row?.client_event_id;
    if (!clientEventId || row.error != null) continue;
    // Idempotent replay: skipped events are still accepted by cloud.
    ids.add(clientEventId);
  }
  return [...ids];
}

/** Map clientEventId → cloud saleId from push response events[]. */
export function collectPushSaleIds(pushResult = {}) {
  const saleIds = new Map();
  for (const row of pushResult.raw?.events ?? pushResult.events ?? []) {
    const clientEventId = row?.clientEventId ?? row?.client_event_id;
    const saleId = row?.saleId ?? row?.sale_id ?? null;
    if (!clientEventId || !saleId || row.error != null) continue;
    saleIds.set(clientEventId, saleId);
  }
  return saleIds;
}
