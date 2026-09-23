# FluxOne POS — Sync Manual E2E Test Plan

Cloud base URL: `https://fluxone-b2b.onrender.com/api`

Demo BM (Wah): `branch.wah@companya.local` / `password`  
Branch UUID (Wah): `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1`

---

| # | Test | Expected |
|---|------|----------|
| 1 | Fresh DB, BM Wah setup | `bootstrapDone=1`, products>0, BM in employees |
| 2 | Login BM offline | Admin dashboard works |
| 3 | Login cashier offline (within 24h window) | POS works |
| 4 | Offline sale | Outbox pending++ |
| 5 | Online sync | Push accepted, pending=0 |
| 6 | Haripur branchId with Wah token (API) | 403 |
| 7 | Delta price change | Local product price updates |
| 8 | Deactivated cashier after delta | Login blocked |
| 9 | Close drawer variance | BM password required, not supervisor PIN |
| 10 | b2b_admin on setup login | Rejected with clear message |
| 11 | POS Items Rate → cloud price | Cloud Selling Price matches POS after Sync Now |

---

## Test 1 — Fresh DB bootstrap

1. Delete or rename `server/data/fluxone.db` (or use a fresh install).
2. Start server / Electron app.
3. Splash → `/setup` (not `/login`).
4. Cloud URL pre-filled → Save & Continue.
5. Login: `branch.wah@companya.local` / `password`.
6. Download & Activate.
7. **Verify:** Setup status shows `bootstrapDone: true`; SQLite has products, categories, BM employee with UUID id and `password_hash`.

## Test 2 — BM offline login

1. Complete Test 1.
2. Disconnect network.
3. Login with BM cloud login ID (email) and password.
4. **Verify:** Admin logs page loads.

## Test 3 — Cashier offline (24h window)

1. Bootstrap includes at least one cashier.
2. Online: login cashier once.
3. Logout, go offline.
4. Login cashier again within 24h.
5. **Verify:** Sync page → open drawer → POS works.

## Test 4 — Offline sale

1. Cashier session open, offline.
2. Complete a sale.
3. **Verify:** `sync_outbox` has pending row; checkout did not call cloud.

## Test 5 — Online push

1. Restore network.
2. Trigger sync (Sync page or background Electron sync).
3. **Verify:** Outbox pending = 0; cloud accepted event; invoice `cloud_synced_at` set if applicable.

## Test 6 — Branch lock (API)

1. Authenticate as Wah BM.
2. Call `GET /sync/bootstrap?branchId=<haripur-uuid>` with Wah JWT.
3. **Verify:** HTTP 403.

## Test 7 — Delta price change

1. Change a product price in cloud admin.
2. Run delta sync on POS.
3. **Verify:** Local product price matches cloud.

## Test 8 — Deactivated cashier

1. Deactivate cashier in cloud.
2. Delta sync on POS.
3. **Verify:** Cashier login blocked locally.

## Test 9 — Drawer variance

1. Open cashier drawer, make sales.
2. Close drawer with counted cash causing |variance| > 500.
3. **Verify:** UI asks for Branch Manager password; BM cloud password works; supervisor PIN field not shown.

## Test 10 — Reject b2b_admin setup

1. Fresh DB, go to setup login.
2. Use `admin@companya.local` / `password`.
3. **Verify:** Error: "Use Branch Manager credentials for this branch terminal".

## Test 11 — POS Items Rate → cloud selling price

1. BM login on POS → Items Rate → change product selling price (e.g. 80 → 100), Save.
2. **Verify local:** `products.price = 100`; `sync_outbox` has pending `product_price_update` with payload `sellingPrice: 100`, `source: pos_items_rate`.
3. Online → Sync Now (or wait for background push).
4. **Verify:** outbox row `sync_status = sent`; Cloud IM Product Management Selling Price = 100 (Final Price recomputed on cloud).
5. Run delta Sync again → POS price stays 100 (no revert to 80).
6. Optional: sell 1 unit → cloud stock still decrements as before.
