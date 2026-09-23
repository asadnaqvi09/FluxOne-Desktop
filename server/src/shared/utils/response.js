export function success(res, data = null, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function error(res, message, status = 400, code = null) {
  const body = { success: false, error: message };
  if (code) body.code = code;
  return res.status(status).json(body);
}
