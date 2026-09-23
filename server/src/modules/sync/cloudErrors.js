export const CLOUD_ERROR_TYPE = Object.freeze({
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  SERVER: 'server',
  CONFIG: 'config',
});

export class CloudError extends Error {
  constructor(message, { type = CLOUD_ERROR_TYPE.SERVER, status = 0, code = null, body = null } = {}) {
    super(message);
    this.name = 'CloudError';
    this.type = type;
    this.status = status;
    this.code = code;
    this.body = body;
    this.isCloudError = true;
  }
}

export function isCloudError(error) {
  return Boolean(error?.isCloudError);
}

export function cloudErrorTypeFromStatus(status) {
  if (status === 401 || status === 403) {
    return CLOUD_ERROR_TYPE.AUTH;
  }
  if (status === 422) {
    return CLOUD_ERROR_TYPE.VALIDATION;
  }
  if (status >= 500) {
    return CLOUD_ERROR_TYPE.SERVER;
  }
  return CLOUD_ERROR_TYPE.VALIDATION;
}
