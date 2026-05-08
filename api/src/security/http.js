const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function splitOriginList(value) {
  return String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function configuredOrigins() {
  return [
    ...splitOriginList(process.env.CORS_ORIGINS),
    ...splitOriginList(process.env.CORS_ORIGIN),
    ...splitOriginList(process.env.FRONTEND_URL),
  ];
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (allowedOrigins.has(origin)) return true;
  if (!isProduction() && DEV_ORIGINS.includes(origin)) return true;
  return false;
}

export function buildCorsOptions() {
  const configured = configuredOrigins();
  const allowedOrigins = new Set([...configured, ...(!isProduction() ? DEV_ORIGINS : [])]);

  if (isProduction() && configured.length === 0) {
    console.warn("[WARN] No CORS_ORIGINS or FRONTEND_URL configured. Browser API calls will be blocked.");
  }

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, isAllowedOrigin(origin, allowedOrigins));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
    optionsSuccessStatus: 204,
  };
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  if (req.path.startsWith("/api") || req.path === "/health") {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}

export function rejectOversizedUrls(maxLength = 2048) {
  return function rejectOversizedUrl(req, res, next) {
    if (req.originalUrl.length > maxLength) {
      return res.status(414).json({ error: "Request URL is too long." });
    }
    return next();
  };
}

export function productionErrorResponseGuard(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (
      res.statusCode >= 500 &&
      process.env.NODE_ENV === "production" &&
      process.env.EXPOSE_ERROR_DETAILS !== "true"
    ) {
      const publicMessage = body?.error || body?.details || body?.message || "Internal server error";
      console.error("[ERROR] Internal API error response", {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        message: String(publicMessage),
      });
      return originalJson({ error: "Internal server error" });
    }

    return originalJson(body);
  };

  next();
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }

  if (err?.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "One or more files exceed the upload size limit."
        : "Upload rejected.";
    return res.status(400).json({ error: message });
  }

  if (err?.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message || "Bad request." });
  }

  console.error("[ERROR] Unhandled API error", {
    method: req.method,
    path: req.originalUrl,
    message: err?.message || String(err),
  });
  return res.status(500).json({ error: "Internal server error" });
}
