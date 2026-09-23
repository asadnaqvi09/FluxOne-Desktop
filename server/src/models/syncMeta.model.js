import { connectDb } from '../config/database.js';

const META_FIELDS = `
  id,
  tenant_id AS tenantId,
  branch_id AS branchId,
  device_id AS deviceId,
  cloud_api_url AS cloudApiUrl,
  last_pull_at AS lastPullAt,
  last_push_at AS lastPushAt,
  bootstrap_done AS bootstrapDone,
  access_token AS accessToken,
  refresh_token AS refreshToken,
  token_expires_at AS tokenExpiresAt
`;

export function getSyncMeta() {
  const db = connectDb();
  const row =
    db.prepare(`SELECT ${META_FIELDS} FROM sync_meta WHERE id = 1`).get() || null;
  if (!row) return null;
  return {
    ...row,
    bootstrapDone: row.bootstrapDone === 1,
  };
}

export function updateSyncMeta(fields = {}) {
  const db = connectDb();
  const current = getSyncMeta();
  const next = {
    tenantId: fields.tenantId !== undefined ? fields.tenantId : current?.tenantId ?? null,
    branchId: fields.branchId !== undefined ? fields.branchId : current?.branchId ?? null,
    deviceId: fields.deviceId !== undefined ? fields.deviceId : current?.deviceId ?? null,
    cloudApiUrl:
      fields.cloudApiUrl !== undefined ? fields.cloudApiUrl : current?.cloudApiUrl ?? null,
    lastPullAt: fields.lastPullAt !== undefined ? fields.lastPullAt : current?.lastPullAt ?? null,
    lastPushAt: fields.lastPushAt !== undefined ? fields.lastPushAt : current?.lastPushAt ?? null,
    bootstrapDone:
      fields.bootstrapDone !== undefined
        ? fields.bootstrapDone
          ? 1
          : 0
        : current?.bootstrapDone
          ? 1
          : 0,
    accessToken:
      fields.accessToken !== undefined ? fields.accessToken : current?.accessToken ?? null,
    refreshToken:
      fields.refreshToken !== undefined ? fields.refreshToken : current?.refreshToken ?? null,
    tokenExpiresAt:
      fields.tokenExpiresAt !== undefined
        ? fields.tokenExpiresAt
        : current?.tokenExpiresAt ?? null,
  };

  db.prepare(
    `
    INSERT INTO sync_meta (
      id, tenant_id, branch_id, device_id, cloud_api_url,
      last_pull_at, last_push_at, bootstrap_done,
      access_token, refresh_token, token_expires_at
    ) VALUES (
      1, @tenantId, @branchId, @deviceId, @cloudApiUrl,
      @lastPullAt, @lastPushAt, @bootstrapDone,
      @accessToken, @refreshToken, @tokenExpiresAt
    )
    ON CONFLICT(id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      branch_id = excluded.branch_id,
      device_id = excluded.device_id,
      cloud_api_url = excluded.cloud_api_url,
      last_pull_at = excluded.last_pull_at,
      last_push_at = excluded.last_push_at,
      bootstrap_done = excluded.bootstrap_done,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at
  `
  ).run(next);

  return getSyncMeta();
}

export function saveCloudTokens({ accessToken, refreshToken, tokenExpiresAt } = {}) {
  return updateSyncMeta({
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    tokenExpiresAt: tokenExpiresAt ?? null,
  });
}

export function clearCloudTokens() {
  return updateSyncMeta({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
  });
}

export function getCloudConfig() {
  const meta = getSyncMeta();
  if (!meta) return null;
  return {
    cloudApiUrl: meta.cloudApiUrl,
    branchId: meta.branchId,
    tenantId: meta.tenantId,
    deviceId: meta.deviceId,
    bootstrapDone: meta.bootstrapDone,
  };
}
