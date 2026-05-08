export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value ?? ""));
}

export function requireUuidParam(name = "id") {
  return function requireUuid(req, res, next) {
    if (!isUuid(req.params[name])) {
      return res.status(400).json({ error: `${name} must be a valid UUID.` });
    }
    return next();
  };
}
