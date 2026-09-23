import { ZodError } from 'zod';
import { error } from '../utils/response.js';

export default function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const msg = err.issues?.[0]?.message || 'Validation failed';
        return error(res, msg, 400);
      }
      return next(err);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.validatedQuery = schema.parse(req.query ?? {});
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const msg = err.issues?.[0]?.message || 'Validation failed';
        return error(res, msg, 400);
      }
      return next(err);
    }
  };
}
