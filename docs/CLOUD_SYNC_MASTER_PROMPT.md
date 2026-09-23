# Cloud Sync Master Prompt (FluxOne POS ↔ B2B Cloud)

Copy-paste this into the **Cloud / B2B Admin** Cursor (or engineer) chat so they can verify push/pull contracts against what POS actually sends and expects.

---

## Role

You are the cloud API owner for FluxOne. The desktop POS (Node/Express + SQLite + Electron) syncs with your cloud. Diagnose mismatches that cause `sync_outbox` rows to become `failed` with `last_error`, and document exact request/response shapes.

## POS identity (always sent with push)

From local `sync_meta` after setup/bootstrap:

- `tenantId`
- `branchId` (required for bootstrap, delta, push)
- `deviceId` (required before push)
- JWT access/refresh tokens from cloud login

If branch/device/JWT do not match the sale’s branch, reject with a **clear string** in `rejected[].error` (POS stores this in `last_error` and shows it in Sync UI).

---

## PULL — what POS expects

### 1) `GET /api/sync/bootstrap?branchId=…` (first online sync)

POS maps the snapshot via `normalizeSnapshot` and applies into SQLite. Expected top-level (camelCase or snake_case accepted where noted):

| Key | Used for |
|-----|----------|
| `tenant` | `tenantId` |
| `branch` | branch name → store_profile.contactEmail (UI “Branch”), phones/address fallback |
| `company` / `companySettings` / `settings` | store_profile: name, phone, address, **warningMessage**, **returnPolicy/return_instructions** (printable policies are packed here), open/close time, currency |
| `users` | employees (roles: `branch_manager`→admin, `cashier`→cashier; skip IM/B2B admin) |
| `categories` (+ nested subcategories) | catalog |
| `products` | catalog + prices |
| `taxes` | tax_rules |
| `productTaxes` / `product_taxes` | product↔tax links |
| `branchInventory` / `branch_inventory` | stock |
| `counters` / `posCounters` / `pos_counters` | POS counters (`id`, `code`, `name`) — **sale push needs counterId/code** |
| `offers` | ignored today |

**Company footer / policies (critical):**

- When printable policies are **ON**, cloud currently packs titles into `warningMessage` / `warning` and full bodies into `returnPolicy` / `return_instructions` as:

  `Name: body…\n\nName: body…`

- When printable policies are **OFF**, cloud **must send empty string `""` (or explicit null keys)** for those fields so POS can clear local `store_profile`. Omitting the whole `company` object does not clear; company present with empty footer does.

### 2) `GET /api/sync/delta?branchId=…&since=…`

Same catalog/company shape as bootstrap (partial OK). POS upserts. Sales history may also be pulled separately via sales pages — POS **does not rewrite** local invoices that still have pending/failed outbox rows (POS wins).

---

## PUSH — what POS sends

### `POST /api/sync/push`

Body shape POS builds:

```json
{
  "deviceId": "<sync_meta.deviceId>",
  "branchId": "<sync_meta.branchId>",
  "events": [
    {
      "clientEventId": "pos-<invoiceId>-sale-<timestamp>",
      "eventType": "sale" | "refund" | "cashier_log" | "attendance" | "product_price_update",
      "deviceId": "<same>",
      "payload": { }
    }
  ]
}
```

### Event: `sale` (checkout / exchange sale)

Payload fields POS sends today (`mapInvoiceToSaleEvent`):

```json
{
  "saleNumber": "INV-1007",
  "invoiceId": "INV-1007",
  "type": "Sale",
  "cashierId": "<employee uuid>",
  "cashierName": null,
  "counterId": "<uuid or null>",
  "counterCode": "<code or null>",
  "paymentMethod": "cash",
  "subtotal": 0,
  "discount": 0,
  "tax": 0,
  "total": 0,
  "tendered": 0,
  "changeDue": 0,
  "netDue": 0,
  "soldAt": "<ISO>",
  "items": [
    {
      "invoiceItemId": "<uuid>",
      "productId": "<uuid>",
      "sku": "...",
      "name": "...",
      "quantity": 1,
      "unitPrice": 0,
      "discount": 0,
      "tax": 0,
      "lineTotal": 0,
      "scale": "unit",
      "isExchange": false
    }
  ],
  "taxes": [ { "name", "rate", "amount", ... } ],
  "exchange": false,
  "exchangedCredit": null,
  "replacementTotal": null
}
```

**Likely reject causes to check on cloud:**

- `counterId` / `counterCode` null (no active counter in bootstrap)
- `cashierId` not linked to branch user
- productId not in branch catalog
- duplicate `saleNumber` / `clientEventId` (must be idempotent accept, not hard fail if already applied)
- tax total mismatch vs lines
- unexpected `type` enum

### Event: `refund`

```json
{
  "saleNumber": "<return invoice id>",
  "invoiceId": "<return invoice id>",
  "originalInvoiceId": "<original sale id>",
  "refundAmount": 0,
  "cashierId": "...",
  "cashierName": null,
  "counterId": null,
  "counterCode": null,
  "paymentMethod": "cash",
  "refundedAt": "<ISO>",
  "soldAt": "<ISO>",
  "items": [ /* same item shape as sale */ ]
}
```

### Event: `cashier_log`

```json
{
  "action": "login|logout|sale|sync|...",
  "employeeId": "...",
  "actorUserId": "email-or-login",
  "actorName": "...",
  "actorRole": "cashier|admin",
  "entityType": "...",
  "entityId": "...",
  "metadata": {},
  "timestamp": "<ISO>",
  "branchId": "...",
  "deviceId": "..."
}
```

### Event: `product_price_update` (Items Rate)

```json
{
  "productId": "...",
  "branchId": "...",
  "sellingPrice": 0,
  "discountPercent": 0,
  "source": "pos_items_rate",
  "updatedAt": "<ISO>",
  "updatedByUserId": "...",
  "deviceId": "..."
}
```

---

## PUSH response contract (critical for POS UI)

POS expects something like:

```json
{
  "success": true,
  "data": {
    "accepted": ["clientEventId...", { "clientEventId": "..." }],
    "rejected": [
      { "clientEventId": "...", "error": "Human-readable reason" }
    ],
    "events": [
      {
        "clientEventId": "...",
        "saleId": "<cloud sale uuid>",
        "error": null
      }
    ]
  }
}
```

Rules:

1. **Always** return per-event accept/reject with `clientEventId`.
2. `rejected[].error` must be a **specific** string (POS shows it on Sync badge + Sync page + logs `[fluxone:sync]`).
3. Idempotent replay: already-applied events → **accepted** (or skipped without error), not rejected.
4. Batch HTTP 422 marks **all** pending events failed with the same message — prefer per-event reject instead.
5. On success for sales, include cloud `saleId` so POS can set `invoices.cloud_sale_id`.

---

## Tasks for Cloud agent

1. Diff your `/sync/push` validator against the sale/refund/cashier_log/product_price_update payloads above.
2. List every validation that returns reject and the exact error string.
3. Confirm bootstrap includes `counters` and `company` footer fields; confirm policy OFF clears footer with `""`.
4. Confirm push is idempotent on `clientEventId`.
5. Return a table: `eventType | required fields | reject reasons | sample error message`.

## Success criteria

- A POS sale that fails shows the **same** cloud error text in:
  - Sync badge hover
  - Sync page
  - POS server terminal line `[fluxone:sync] Cloud REJECTED …`
- Retry after fixing cloud data succeeds and clears `failedOutbox` to 0.
