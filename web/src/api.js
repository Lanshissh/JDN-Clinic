const BASE = import.meta.env.VITE_API_BASE || "";

const TOKEN_KEY = "nurse_token";
const TOKEN_EXPIRY_KEY = "nurse_token_expires_at";

function getStorage(remember) {
  return remember ? window.localStorage : window.sessionStorage;
}

function removeTokenFromStorage(storage) {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(TOKEN_EXPIRY_KEY);
}

function readTokenFromStorage(storage) {
  const token = storage.getItem(TOKEN_KEY);
  if (!token) return "";

  const expiresAt = storage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    removeTokenFromStorage(storage);
    return "";
  }

  return token;
}

export function getNurseToken() {
  return (
    readTokenFromStorage(window.sessionStorage) ||
    readTokenFromStorage(window.localStorage) ||
    ""
  );
}

export function setNurseToken(token, { remember = false, expiresAt } = {}) {
  clearNurseToken();

  if (!token || !expiresAt) return;
  const storage = getStorage(remember);
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
}

export function clearNurseToken() {
  removeTokenFromStorage(window.sessionStorage);
  removeTokenFromStorage(window.localStorage);
}

function authHeaders() {
  const token = getNurseToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponseBody(res) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleResponse(res) {
  if (res.status === 401) {
    clearNurseToken();
  }

  const body = await parseResponseBody(res);

  if (!res.ok) {
    const message =
      typeof body === "object" && body
        ? body.details || body.error || `Request failed with status ${res.status}`
        : body || `Request failed with status ${res.status}`;

    const error = new Error(message);
    error.status = res.status;
    error.payload = body;
    throw error;
  }

  return body;
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: {
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export function formatApiError(error, fallback = "Something went wrong. Please try again.") {
  const payload = error?.payload;
  const message =
    (typeof payload === "object" && payload
      ? payload.details || payload.error
      : payload) ||
    error?.message ||
    fallback;

  return String(message).replace(/^Error:\s*/i, "") || fallback;
}

export async function nurseLogin(username, password, { remember = false } = {}) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, remember }),
  });

  const data = await handleResponse(res);

  const token = data?.token || "";
  const expiresAt = data?.expires_at || "";
  if (!token) throw new Error("Login succeeded but no token returned.");
  if (!expiresAt) throw new Error("Login succeeded but no expiry returned.");

  setNurseToken(token, { remember, expiresAt });
  return token;
}
