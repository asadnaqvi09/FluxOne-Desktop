import { error } from '../utils/response.js';

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || 500;
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';
  return error(res, message, status, err.code || null);
}

export function notFound(req, res) {
  return error(res, 'Not found', 404);
}
