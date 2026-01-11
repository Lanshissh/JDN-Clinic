import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.js";

dotenv.config(); // ✅ FIXED for Render

const app = express();

// ✅ CORS (tighten later with frontend URL)
app.use(cors());
app.use(express.json());

/**
 * =========================
 * Single Nurse Auth
 * =========================
 */
function requireEnv(name) {
  if (!process.env[name]) {
    console.warn(`[WARN] Missing env var: ${name}`);
  }
}
requireEnv("NURSE_USERNAME");
requireEnv("NURSE_PASSWORD");
requireEnv("NURSE_TOKEN");

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const [type, token] = h.split(" ");
  if (type !== "Bearer") return "";
  return token || "";
}

// ✅ Login endpoint (public)
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  if (
    !process.env.NURSE_USERNAME ||
    !process.env.NURSE_PASSWORD ||
    !process.env.NURSE_TOKEN
  ) {
    return res.status(500).json({
      error: "Server auth not configured",
    });
  }

  if (
    username !== process.env.NURSE_USERNAME ||
    password !== process.env.NURSE_PASSWORD
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  return res.json({ token: process.env.NURSE_TOKEN });
});

// ✅ Protect all /api routes except login
app.use("/api", (req, res, next) => {
  if (req.path === "/auth/login") return next();

  const token = getBearerToken(req);
  if (token !== process.env.NURSE_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ✅ Protected routes
app.use("/api", routes);

// ✅ Health check (public)
app.get("/health", (_, res) => res.json({ ok: true }));

// ✅ Render-compatible port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});