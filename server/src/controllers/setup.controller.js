import { randomUUID } from 'node:crypto';
import { success, error } from '../shared/utils/response.js';
import { isRequestOnline } from '../shared/middlewares/online.middleware.js';
import * as syncMetaModel from '../models/syncMeta.model.js';
import * as cloudClient from '../modules/sync/cloudClient.js';
import * as syncService from '../modules/sync/syncService.js';
import { CloudError, CLOUD_ERROR_TYPE } from '../modules/sync/cloudErrors.js';

function ensureDeviceId() {
  const meta = syncMetaModel.getSyncMeta();
  if (meta?.deviceId) return meta.deviceId;
  const deviceId = randomUUID();
  syncMetaModel.updateSyncMeta({ deviceId });
  return deviceId;
}

function publicSetupStatus() {
  const meta = syncMetaModel.getSyncMeta();
  return {
    bootstrapDone: Boolean(meta?.bootstrapDone),
    cloudConfigured: cloudClient.isCloudConfigured(),
    cloudApiUrl: meta?.cloudApiUrl ?? null,
    deviceId: meta?.deviceId ?? null,
    branchId: meta?.branchId ?? null,
    tenantId: meta?.tenantId ?? null,
  };
}

function normalizeBranches(loginData = {}) {
  const raw =
    loginData.branches ??
    loginData.branchList ??
    loginData.user?.branches ??
    loginData.availableBranches ??
    [];
  const list = Array.isArray(raw) ? [...raw] : [];

  const single = loginData.branch ?? loginData.user?.branch ?? null;
  if (single?.id && !list.some((branch) => branch.id === single.id)) {
    list.unshift(single);
  }

  const userBranchId =
    loginData.user?.branchId ?? loginData.user?.branch_id ?? null;
  if (userBranchId && !list.some((branch) => branch.id === userBranchId)) {
    list.push({
      id: userBranchId,
      name:
        loginData.user?.branchName ??
        loginData.user?.branch_name ??
        userBranchId,
      code: null,
    });
  }

  return list
    .map((branch) => ({
      id: branch.id,
      name: branch.name ?? branch.branchName ?? branch.code ?? branch.id,
      code: branch.code ?? null,
    }))
    .filter((branch) => branch.id);
}

function resolveBranchManagerRole(loginData = {}) {
  return String(
    loginData.user?.role?.slug ??
      loginData.user?.roleSlug ??
      loginData.user?.role ??
      ''
  ).toLowerCase();
}

/** GET /api/setup/status */
export function status(req, res) {
  return success(res, publicSetupStatus());
}

/** POST /api/setup/configure */
export function configure(req, res) {
  const meta = syncMetaModel.getSyncMeta();
  if (meta?.bootstrapDone) {
    return error(res, 'Device already activated', 409, 'ALREADY_BOOTSTRAPPED');
  }

  const cloudApiUrl = req.body.cloudApiUrl;
  const deviceId = ensureDeviceId();
  syncMetaModel.updateSyncMeta({ cloudApiUrl });

  return success(res, {
    ...publicSetupStatus(),
    deviceId,
    cloudApiUrl: cloudClient.resolveCloudApiBase(cloudApiUrl),
  });
}

/** POST /api/setup/login — cloud credentials */
export async function login(req, res) {
  try {
    const meta = syncMetaModel.getSyncMeta();
    if (meta?.bootstrapDone) {
      return error(res, 'Device already activated', 409, 'ALREADY_BOOTSTRAPPED');
    }
    if (!cloudClient.isCloudConfigured()) {
      return error(res, 'Configure cloud API URL first', 400, 'CLOUD_NOT_CONFIGURED');
    }
    if (!isRequestOnline(req)) {
      return error(res, 'Network required for cloud login', 503, 'OFFLINE');
    }

    ensureDeviceId();
    const data = await cloudClient.login(req.body.id, req.body.password);

    const cloudRole = resolveBranchManagerRole(data);
    if (cloudRole === 'b2b_admin' || cloudRole === 'inventory_manager') {
      return error(
        res,
        'Use Branch Manager credentials for this branch terminal',
        403,
        'BM_ONLY'
      );
    }
    if (cloudRole && cloudRole !== 'branch_manager') {
      return error(
        res,
        'Use Branch Manager credentials for this branch terminal',
        403,
        'BM_ONLY'
      );
    }

    const branches = normalizeBranches(data);
    const tenantId =
      data.tenantId ?? data.tenant_id ?? data.user?.tenantId ?? data.user?.tenant_id ?? null;

    if (tenantId) {
      syncMetaModel.updateSyncMeta({ tenantId });
    }

    const userBranchId = data.user?.branchId ?? data.user?.branch_id ?? null;
    let autoSelectedBranchId = null;
    if (branches.length === 1) {
      autoSelectedBranchId = branches[0].id;
    } else if (userBranchId) {
      autoSelectedBranchId = userBranchId;
    }
    if (autoSelectedBranchId) {
      syncMetaModel.updateSyncMeta({ branchId: autoSelectedBranchId });
    }

    return success(res, {
      branches,
      tenantId,
      deviceId: syncMetaModel.getSyncMeta()?.deviceId,
      autoSelectedBranchId,
      branchId: autoSelectedBranchId,
      branchName:
        branches.find((branch) => branch.id === autoSelectedBranchId)?.name ??
        data.user?.branchName ??
        data.user?.branch_name ??
        null,
    });
  } catch (err) {
    if (err instanceof CloudError) {
      const status =
        err.type === CLOUD_ERROR_TYPE.AUTH
          ? 401
          : err.type === CLOUD_ERROR_TYPE.NETWORK
            ? 503
            : 502;
      return error(res, err.message, status, err.code || null);
    }
    return error(res, err.message || 'Cloud login failed', 500);
  }
}

/** POST /api/setup/bootstrap — download catalog and lock branch + device */
export async function bootstrap(req, res) {
  try {
    const meta = syncMetaModel.getSyncMeta();
    if (meta?.bootstrapDone) {
      return error(res, 'Device already activated', 409, 'ALREADY_BOOTSTRAPPED');
    }
    if (!cloudClient.isCloudConfigured()) {
      return error(res, 'Configure cloud API URL first', 400, 'CLOUD_NOT_CONFIGURED');
    }
    if (!isRequestOnline(req)) {
      return error(res, 'Network required for bootstrap', 503, 'OFFLINE');
    }

    const branchId = req.body.branchId || meta?.branchId;
    if (!branchId) {
      return error(res, 'branchId is required', 400, 'BRANCH_ID_REQUIRED');
    }

    const current = syncMetaModel.getSyncMeta();
    if (!current?.accessToken) {
      return error(res, 'Cloud login required before bootstrap', 401, 'CLOUD_AUTH_REQUIRED');
    }

    const deviceId = ensureDeviceId();
    syncMetaModel.updateSyncMeta({ branchId, deviceId });

    const result = await syncService.pullBootstrap(branchId);

    return success(res, {
      bootstrap: result.counts,
      meta: publicSetupStatus(),
      deviceId,
      branchId,
    });
  } catch (err) {
    if (err instanceof CloudError) {
      const status =
        err.type === CLOUD_ERROR_TYPE.AUTH
          ? 401
          : err.type === CLOUD_ERROR_TYPE.NETWORK
            ? 503
            : 502;
      return error(res, err.message, status, err.code || null);
    }
    return error(res, err.message || 'Bootstrap failed', 500);
  }
}
