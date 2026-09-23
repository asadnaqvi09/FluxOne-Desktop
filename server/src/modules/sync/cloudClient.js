import * as syncMetaModel from '../../models/syncMeta.model.js';
import {
  CloudError,
  CLOUD_ERROR_TYPE,
  cloudErrorTypeFromStatus,
} from './cloudErrors.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function trimTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveCloudApiBase(cloudApiUrl) {
  const root = trimTrailingSlashes(cloudApiUrl);
  if (!root) return '';
  return root.endsWith('/api') ? root : `${root}/api`;
}

function buildUrl(apiBase, path, query = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBase}${normalizedPath}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseCloudJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new CloudError('Invalid JSON response from cloud API', {
      type: CLOUD_ERROR_TYPE.SERVER,
      status: 502,
    });
  }
}

function unwrapCloudData(json) {
  if (json && json.success === true && 'data' in json) {
    return json.data;
  }
  if (json && json.success === false) {
    const message = json.error || json.message || 'Cloud request failed';
    throw new CloudError(message, {
      type: CLOUD_ERROR_TYPE.VALIDATION,
      status: 400,
      body: json,
    });
  }
  return json;
}

function parseTokenBundle(payload = {}) {
  const accessToken =
    payload.accessToken ?? payload.access_token ?? payload.token ?? null;
  const refreshToken =
    payload.refreshToken ?? payload.refresh_token ?? null;

  let tokenExpiresAt =
    payload.tokenExpiresAt ?? payload.token_expires_at ?? payload.expiresAt ?? null;

  const expiresIn = payload.expiresIn ?? payload.expires_in;
  if (!tokenExpiresAt && Number.isFinite(Number(expiresIn))) {
    tokenExpiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
  }

  return { accessToken, refreshToken, tokenExpiresAt };
}

function getConfiguredApiBase() {
  const meta = syncMetaModel.getSyncMeta();
  const apiBase = resolveCloudApiBase(meta?.cloudApiUrl);
  if (!apiBase) {
    throw new CloudError('Cloud API URL is not configured', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'CLOUD_NOT_CONFIGURED',
    });
  }
  return apiBase;
}

function tokenNeedsRefresh(meta) {
  if (!meta?.accessToken) return false;
  if (!meta.tokenExpiresAt) return false;
  const expiresAt = Date.parse(meta.tokenExpiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt - TOKEN_REFRESH_BUFFER_MS <= Date.now();
}

async function cloudFetch(url, { method = 'GET', body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    method,
    headers: { Accept: 'application/json', ...headers },
    signal: controller.signal,
  };

  if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const text = await response.text();
    const json = parseCloudJson(text);

    if (!response.ok) {
      const message =
        json?.error || json?.message || `Cloud request failed (${response.status})`;
      throw new CloudError(message, {
        type: cloudErrorTypeFromStatus(response.status),
        status: response.status,
        code: json?.code ?? null,
        body: json,
      });
    }

    return unwrapCloudData(json);
  } catch (error) {
    if (error instanceof CloudError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new CloudError('Cloud request timed out', {
        type: CLOUD_ERROR_TYPE.NETWORK,
        status: 0,
        code: 'TIMEOUT',
      });
    }
    throw new CloudError(error?.message || 'Network error reaching cloud API', {
      type: CLOUD_ERROR_TYPE.NETWORK,
      status: 0,
      code: 'NETWORK',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function authorizedRequest(path, options = {}) {
  const accessToken = await ensureValidJwt();
  const apiBase = getConfiguredApiBase();
  const url = buildUrl(apiBase, path, options.query);
  return cloudFetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function isCloudConfigured() {
  const meta = syncMetaModel.getSyncMeta();
  return Boolean(resolveCloudApiBase(meta?.cloudApiUrl));
}

export async function login(id, password) {
  const apiBase = getConfiguredApiBase();
  const url = buildUrl(apiBase, '/auth/login');
  const data = await cloudFetch(url, {
    method: 'POST',
    body: { id, password },
  });

  const tokenBundle = parseTokenBundle(data);
  if (!tokenBundle.accessToken) {
    throw new CloudError('Cloud login did not return an access token', {
      type: CLOUD_ERROR_TYPE.AUTH,
      status: 401,
      body: data,
    });
  }

  syncMetaModel.saveCloudTokens(tokenBundle);

  const tenantId = data.tenantId ?? data.tenant_id ?? data.user?.tenantId ?? null;
  if (tenantId) {
    syncMetaModel.updateSyncMeta({ tenantId });
  }

  return {
    ...data,
    ...tokenBundle,
    branches: data.branches ?? data.branchList ?? [],
  };
}

export async function refreshTokens() {
  const meta = syncMetaModel.getSyncMeta();
  if (!meta?.refreshToken) {
    syncMetaModel.clearCloudTokens();
    throw new CloudError('Cloud refresh token is missing', {
      type: CLOUD_ERROR_TYPE.AUTH,
      status: 401,
      code: 'REFRESH_TOKEN_MISSING',
    });
  }

  const apiBase = getConfiguredApiBase();
  const url = buildUrl(apiBase, '/auth/refresh');
  const data = await cloudFetch(url, {
    method: 'POST',
    body: { refreshToken: meta.refreshToken },
    headers: meta.accessToken
      ? { Authorization: `Bearer ${meta.accessToken}` }
      : undefined,
  });

  const tokenBundle = parseTokenBundle(data);
  if (!tokenBundle.accessToken) {
    syncMetaModel.clearCloudTokens();
    throw new CloudError('Cloud token refresh did not return an access token', {
      type: CLOUD_ERROR_TYPE.AUTH,
      status: 401,
      body: data,
    });
  }

  syncMetaModel.saveCloudTokens({
    accessToken: tokenBundle.accessToken,
    refreshToken: tokenBundle.refreshToken ?? meta.refreshToken,
    tokenExpiresAt: tokenBundle.tokenExpiresAt,
  });

  return tokenBundle;
}

export async function ensureValidJwt() {
  const meta = syncMetaModel.getSyncMeta();
  if (!meta?.accessToken) {
    throw new CloudError('Not authenticated with cloud API', {
      type: CLOUD_ERROR_TYPE.AUTH,
      status: 401,
      code: 'CLOUD_AUTH_REQUIRED',
    });
  }

  if (tokenNeedsRefresh(meta)) {
    await refreshTokens();
    return syncMetaModel.getSyncMeta()?.accessToken || null;
  }

  return meta.accessToken;
}

export async function getBootstrap(branchId) {
  const resolvedBranchId = branchId || syncMetaModel.getSyncMeta()?.branchId;
  if (!resolvedBranchId) {
    throw new CloudError('branchId is required for bootstrap', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'BRANCH_ID_REQUIRED',
    });
  }

  return authorizedRequest('/sync/bootstrap', {
    query: { branchId: resolvedBranchId },
  });
}

export async function getDelta(branchId, since) {
  const resolvedBranchId = branchId || syncMetaModel.getSyncMeta()?.branchId;
  if (!resolvedBranchId) {
    throw new CloudError('branchId is required for delta sync', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'BRANCH_ID_REQUIRED',
    });
  }
  if (!since) {
    throw new CloudError('since timestamp is required for delta sync', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'SINCE_REQUIRED',
    });
  }

  return authorizedRequest('/sync/delta', {
    query: { branchId: resolvedBranchId, since },
  });
}

/**
 * Page of branch sales history (current state per saleNumber).
 * Does not adjust stock — catalog/inventory comes from bootstrap/delta + push ledger.
 */
export async function getSalesPage({ branchId, page = 1, limit = 100 } = {}) {
  const resolvedBranchId = branchId || syncMetaModel.getSyncMeta()?.branchId;
  if (!resolvedBranchId) {
    throw new CloudError('branchId is required for sales pull', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'BRANCH_ID_REQUIRED',
    });
  }

  const data = await authorizedRequest('/sync/sales', {
    query: {
      branchId: resolvedBranchId,
      page,
      limit,
    },
  });

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    pagination: data?.pagination ?? {
      page,
      limit,
      total: 0,
      pageCount: 0,
    },
  };
}

export async function pushEvents(events = []) {
  if (!Array.isArray(events) || events.length === 0) {
    return { accepted: [], rejected: [] };
  }

  const meta = syncMetaModel.getSyncMeta();
  const deviceId = meta?.deviceId;
  const branchId = meta?.branchId;
  if (!deviceId) {
    throw new CloudError('deviceId is required before pushing sync events', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'DEVICE_ID_REQUIRED',
    });
  }
  if (!branchId) {
    throw new CloudError('branchId is required before pushing sync events', {
      type: CLOUD_ERROR_TYPE.CONFIG,
      status: 0,
      code: 'BRANCH_ID_REQUIRED',
    });
  }

  const payload = {
    deviceId,
    branchId,
    events: events.map((event) => ({
      clientEventId: event.clientEventId,
      eventType: event.eventType,
      payload: event.payload,
      deviceId: event.deviceId || deviceId,
    })),
  };

  const data = await authorizedRequest('/sync/push', {
    method: 'POST',
    body: payload,
  });

  return {
    accepted: data?.accepted ?? data?.results?.accepted ?? [],
    rejected: data?.rejected ?? data?.results?.rejected ?? [],
    events: data?.events ?? [],
    raw: data,
  };
}

export function configureCloudApiUrl(cloudApiUrl) {
  return syncMetaModel.updateSyncMeta({ cloudApiUrl });
}

export default {
  resolveCloudApiBase,
  isCloudConfigured,
  configureCloudApiUrl,
  login,
  refreshTokens,
  ensureValidJwt,
  getBootstrap,
  getDelta,
  getSalesPage,
  pushEvents,
};
