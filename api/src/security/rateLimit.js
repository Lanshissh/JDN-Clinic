const DEFAULT_WINDOW_MS = 60 * 1000;

function clientKey(req, keyPrefix) {
  return `${keyPrefix}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = 120,
  message = "Too many requests. Please try again later.",
  keyPrefix = "global",
} = {}) {
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Math.floor(Number(max)) : 120;
  const windowLength =
    Number.isFinite(Number(windowMs)) && Number(windowMs) > 0 ? Math.floor(Number(windowMs)) : DEFAULT_WINDOW_MS;
  const buckets = new Map();
  let requestsSeen = 0;

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = clientKey(req, keyPrefix);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowLength });
      res.setHeader("RateLimit-Limit", String(limit));
      res.setHeader("RateLimit-Remaining", String(Math.max(limit - 1, 0)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(limit - current.count, 0);
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(remaining));

    if (current.count > limit) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    requestsSeen += 1;
    if (requestsSeen % 500 === 0) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    return next();
  };
}
