import crypto from "crypto";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEFAULT_REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const TOKEN_VERSION = "v1";

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.warn(`[WARN] ${name} must be a positive integer. Using ${fallback}.`);
    return fallback;
  }

  return Math.min(value, MAX_SESSION_TTL_SECONDS);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error("Server auth not configured");
  }
  return value;
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");

  if (leftBuffer.length === rightBuffer.length) {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  const leftHash = crypto.createHash("sha256").update(leftBuffer).digest();
  const rightHash = crypto.createHash("sha256").update(rightBuffer).digest();
  crypto.timingSafeEqual(leftHash, rightHash);
  return false;
}

function signPayload(payload) {
  const secret = requiredEnv("NURSE_TOKEN");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function getTtlSeconds(remember) {
  return readPositiveIntEnv(
    remember ? "NURSE_REMEMBER_TTL_SECONDS" : "NURSE_SESSION_TTL_SECONDS",
    remember ? DEFAULT_REMEMBER_TTL_SECONDS : DEFAULT_SESSION_TTL_SECONDS
  );
}

export function validateAuthEnvironment() {
  for (const name of ["NURSE_USERNAME", "NURSE_PASSWORD", "NURSE_TOKEN"]) {
    if (!process.env[name]) {
      console.warn(`[WARN] Missing env var: ${name}`);
    }
  }

  if (process.env.NURSE_TOKEN && process.env.NURSE_TOKEN.length < 32) {
    console.warn("[WARN] NURSE_TOKEN should be at least 32 characters for session signing.");
  }
}

export function isAuthConfigured() {
  return Boolean(process.env.NURSE_USERNAME && process.env.NURSE_PASSWORD && process.env.NURSE_TOKEN);
}

export function credentialsMatch(username, password) {
  if (!isAuthConfigured()) return false;

  return (
    timingSafeEqualString(username, process.env.NURSE_USERNAME) &&
    timingSafeEqualString(password, process.env.NURSE_PASSWORD)
  );
}

export function issueSessionToken({ remember = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = getTtlSeconds(Boolean(remember));
  const payload = {
    v: 1,
    sub: "nurse",
    iat: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);

  return {
    token: `${TOKEN_VERSION}.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifySessionToken(rawToken) {
  const token = String(rawToken ?? "").trim();
  if (!token || token.length > 4096) {
    return { ok: false, code: "invalid" };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return { ok: false, code: "invalid" };
  }

  const [, encodedPayload, signature] = parts;
  const expectedSignature = signPayload(encodedPayload);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { ok: false, code: "invalid" };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (payload.v !== 1 || payload.sub !== "nurse") {
      return { ok: false, code: "invalid" };
    }

    if (!Number.isInteger(payload.exp) || payload.exp <= now) {
      return { ok: false, code: "expired" };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, code: "invalid" };
  }
}
