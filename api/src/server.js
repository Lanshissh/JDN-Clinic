import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.js";
import {
  credentialsMatch,
  isAuthConfigured,
  issueSessionToken,
  validateAuthEnvironment,
  verifySessionToken,
} from "./security/auth.js";
import { createRateLimiter } from "./security/rateLimit.js";
import {
  buildCorsOptions,
  errorHandler,
  productionErrorResponseGuard,
  rejectOversizedUrls,
  securityHeaders,
} from "./security/http.js";

dotenv.config();

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));
app.set("query parser", "simple");

app.use(rejectOversizedUrls());
app.use(securityHeaders);
app.use(productionErrorResponseGuard);
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "100kb", strict: true }));

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 5),
  keyPrefix: "auth-login",
  message: "Too many login attempts. Please wait and try again.",
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 300),
  keyPrefix: "api",
});

validateAuthEnvironment();

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const [type, token] = h.split(/\s+/);
  if (type !== "Bearer") return "";
  return token || "";
}

app.post("/api/auth/login", authLimiter, (req, res) => {
  const { username, password, remember = false } = req.body || {};

  if (!isAuthConfigured()) {
    return res.status(500).json({
      error: "Server auth not configured",
    });
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (username.length > 128 || password.length > 256 || !credentialsMatch(username, password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const session = issueSessionToken({ remember: Boolean(remember) });
  return res.json({ token: session.token, expires_at: session.expiresAt });
});

app.use("/api", apiLimiter, (req, res, next) => {
  if (req.path === "/auth/login") return next();

  const session = verifySessionToken(getBearerToken(req));
  if (!session.ok) {
    return res.status(401).json({
      error: session.code === "expired" ? "Session expired" : "Unauthorized",
      code: session.code === "expired" ? "SESSION_EXPIRED" : "UNAUTHORIZED",
    });
  }

  return next();
});

app.use("/api", routes);

app.get("/health", (_, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
