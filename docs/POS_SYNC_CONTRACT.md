# FluxOne POS ↔ Cloud Sync Contract v1

**Production base URL:** `https://fluxone-b2b.onrender.com/api`

**Response wrapper (all endpoints):**

```json
{ "success": boolean, "data": T | null, "error": string | null }
```

---

## Authentication

### POST `/auth/login`

**Request:**

```json
{
  "id": "branch.wah@companya.local",
  "password": "password"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "token": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 900,
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "user": {
      "id": "a2222222-2222-2222-2222-222222222222",
      "name": "Bilal Khan",
      "email": "branch.wah@companya.local",
      "role": "branch_manager",
      "tenantId": "11111111-1111-1111-1111-111111111111",
      "branchId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      "branchName": "Company A - Wah Cantt"
    },
    "branches": [
      {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        "name": "Company A - Wah Cantt",
        "code": null
      }
    ]
  },
  "error": null
}
```

- `branch_manager` / `cashier`: `branches.length === 1` (JWT branch only).
- `b2b_admin`: all tenant branches in `branches[]` — **POS setup must REJECT `b2b_admin`** (BM only).
- `accessToken` and `token` are identical (backward compatible).

### POST `/auth/refresh`

Same data shape as login. Body: `{ "refreshToken": "..." }`.

---

## Sync pull (catalog)

**Auth:** Bearer JWT with `sync:pull` (`branch_manager`, `cashier`, `b2b_admin`, …).

**Branch lock:** For `branch_manager`, `cashier`, `inventory_manager`, `branch_admin` — query `branchId` must match JWT `branchId` → **403** on mismatch.

### GET `/sync/bootstrap?branchId={uuid}`

Full branch-scoped snapshot for first POS install.

**Users included:**

- Active `branch_manager` where `branch_id = branchId`
- Active `cashier` where `branch_id = branchId`
- Each user includes `passwordHash` (bcrypt). Never plain passwords.
- Never `inventory_manager` or `b2b_admin`.

**Response sections:** `syncVersion`, `tenant`, `branch`, `users`, `categories`, `products`, `taxes`, `offers`, `branchInventory`, `counters`, `company`, `productTaxes`.

**Dual field aliases (cloud + POS):**

| Cloud field | POS alias |
|-------------|-----------|
| `fullName` | `name` |
| `loginId` | `email` |
| `itemCode` | `sku` |
| `sellingPrice` | `price` |
| `ratePercent` | `rate` |
| `status: "active"` | `isActive: true` |
| `products[].taxIds[]` | flattened `productTaxes[]` |
| `contactPhone` | `phone` |

### GET `/sync/delta?branchId={uuid}&since={ISO8601}`

Same shape as bootstrap. `since` is exclusive — rows with `created_at > since` (or `updated_at > since` for `branch_inventory`).

- `taxes` and `offers` are full refresh each delta (small tenant-wide tables).

---

## Sync push (sales outbox)

**Auth:** Bearer JWT with `sync:push`.

**Rate limit:** 400 requests / 15 minutes (`/api/sync/*`).

**Branch lock:** JWT `branchId` must match body `branchId` when provided (branch-scoped roles). Body `branchId` required for `b2b_admin`.

### POST `/sync/push`

**Request (POS-shaped — aliases accepted):**

```json
{
  "deviceId": "terminal-001",
  "branchId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
  "events": [
    {
      "clientEventId": "pos-sale-20260831-001",
      "eventType": "sale",
      "payload": {
        "invoiceId": "INV-1009",
        "soldAt": "2026-08-31T10:00:00.000Z",
        "counterCode": "C1",
        "cashierId": "a2222222-2222-2222-2222-222222222222",
        "paymentMethod": "cash",
        "subtotal": 1000,
        "tax": 170,
        "discount": 50,
        "total": 1120,
        "tendered": 1500,
        "changeDue": 380,
        "status": "completed",
        "items": [
          {
            "productId": "<uuid>",
            "quantity": 2,
            "scale": "piece",
            "unitPrice": 500,
            "discount": 25,
            "tax": 85,
            "lineTotal": 975,
            "isExchange": false
          }
        ]
      }
    }
  ]
}
```

**Response 202:**

```json
{
  "success": true,
  "data": {
    "accepted": ["pos-sale-20260831-001"],
    "rejected": [],
    "events": [{ "clientEventId": "...", "skipped": false, "saleId": "<uuid>" }],
    "acceptedCount": 1
  }
}
```

- Idempotent replay → same `clientEventId` in `accepted[]`, `skipped: true`.
- Per-event failures → `rejected[]`; batch continues.
- Event types: `sale`, `refund`, `cashier_log`, `attendance`, `product_price_update`
- Exchange v1: `isExchange: true` on line OR separate sale + refund. No exchange event type.

### Cashier log (POS activity → cloud branch Activity Logs)

POS queues ops/auth actions as `cashier_log` for Branch Manager Profile → Logs on Inventory cloud.
Commerce stays on `sale` / `refund` (already include `cashierName`) — cloud should map those into the activity feed separately; do **not** expect a duplicate `cashier_log` per sale.

**POS actions that emit `cashier_log`:** `login`, `logout`, `open_cash_drawer`, `close_cash_drawer`, `price_change`, `change_cashier`.

**Local-only (not synced as `cashier_log`):** `lock`, `unlock`, `sync`, and sale/return/exchange activity rows.

```json
{
  "clientEventId": "pos-<employeeId>-login-<shortUuid>-<timestamp>",
  "eventType": "cashier_log",
  "payload": {
    "action": "login",
    "employeeId": "<pos-employee-uuid>",
    "actorUserId": "<employees.user_id / cloud login id>",
    "actorName": "Ali Khan",
    "actorRole": "cashier",
    "entityType": "auth_session",
    "entityId": "<session-uuid>",
    "metadata": {},
    "timestamp": "2026-09-14T06:55:00.000Z",
    "branchId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    "deviceId": "<pos-device-uuid>"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `action` | yes | Stable slug (see list above) |
| `employeeId` | yes | POS local employee id — may **not** equal cloud user UUID |
| `actorName` | yes (for BM UI) | Display name for “{Person} performed …” |
| `actorRole` | yes (for BM UI) | `cashier` \| `admin` \| `supervisor` |
| `actorUserId` | preferred | Cloud-facing login / `employees.user_id` when provisioned |
| `entityType` / `entityId` | optional | Context (session, drawer, product, employee) |
| `metadata` | object | Parsed JSON details (never rely on raw string alone) |
| `timestamp` | yes | ISO-8601 |
| `branchId` / `deviceId` | when provisioned | From POS sync meta |

**Inventory ingest note:** stop treating `cashier_log` as store-only in `pos_sync_events`. Insert into cloud `activity_logs` (or equivalent) using `actorName` + `action` + `timestamp`. Prefer `actorUserId` over POS `employeeId` when linking to cloud users.

### Product price update (POS Items Rate → Cloud)

POS Admin Items Rate queues a catalog write (not only `cashier_log`). Cloud Policy A: branch-scoped `products.selling_price`.

```json
{
  "clientEventId": "pos-price-<productId>-<timestamp>",
  "eventType": "product_price_update",
  "payload": {
    "productId": "<uuid>",
    "branchId": "<uuid>",
    "sellingPrice": 100,
    "discountPercent": 0,
    "source": "pos_items_rate",
    "updatedAt": "2026-09-06T18:00:00.000Z",
    "updatedByUserId": "<uuid>",
    "deviceId": "<uuid>"
  }
}
```

- Cloud Final Price is computed on read (selling × discounts × tax) — POS does not push final price.
- Idempotent: duplicate `clientEventId` → skipped. Last-write-wins on `selling_price`.
- After accept, delta returns the product via `updated_at` so other terminals stay in sync.

**Deprecated:** `GET /sync/pull` — NOT catalog bootstrap.

---

## Cloud credentials (Inventory — not POS seed)

POS ships **no local demo users**. After Setup → bootstrap, sign in with login IDs created in FluxOne Inventory (Branch Manager / Cashier). Inventory QA environments may publish their own test accounts separately.
