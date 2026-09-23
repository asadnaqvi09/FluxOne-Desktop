import { success, error } from '../shared/utils/response.js';
import * as storeModel from '../models/store.model.js';

// GET /api/admin/store-profile
export function get(req, res) {
  try {
    const store = storeModel.getProfile();
    if (!store) return error(res, 'Store profile not found', 404);
    return success(res, { store });
  } catch (err) {
    return error(res, err.message || 'Failed to load store profile', err.statusCode || 500, err.code || null);
  }
}

// PATCH /api/admin/store-profile — invoice footer text
export function update(req, res) {
  try {
    const store = storeModel.updateProfile(req.body);
    if (!store) return error(res, 'Store profile not found', 404);
    return success(res, { store });
  } catch (err) {
    return error(res, err.message || 'Failed to update store profile', err.statusCode || 500, err.code || null);
  }
}
