import config from '../../config/index.js';
import { error } from '../utils/response.js';
import { ERROR_CODE } from '../../config/constants.js';

export function isRequestOnline(req) {
  const header = req.headers['x-network-status'];
  if (header === 'offline') {
    return false;
  }
  if (header === 'online') {
    return true;
  }
  return config.isOnline;
}

export function requireOnline(req, res, next) {
  if (!isRequestOnline(req)) {
    return error(res, 'Network required', 503, ERROR_CODE.OFFLINE);
  }
  return next();
}
