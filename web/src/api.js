const BASE = import.meta.env.VITE_API_BASE;

const TOKEN_KEY = "nurse_token";

/**
 * Token storage strategy:
 * - "remember me" ON  => localStorage (persistent)
 * - "remember me" OFF => sessionStorage (clears when tab/browser closes)
 */
function getStorage(remember) {
  return remember ? window.localStorage : window.sessionStorage;
}

export function getNurseToken() {
  // Prefer session token (current session) then fallback to remembered token
  return (
    window.sessionStorage.getItem(TOKEN_KEY) ||
    window.localStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

export function setNurseToken(token, { remember = true } = {}) {
  // Clear both first so we don't keep duplicates
  clearNurseToken();

  if (!token) return;
  getStorage(remember).setItem(TOKEN_KEY, token);
}

export function clearNurseToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getNurseToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (res.status === 401) {
    // token missing/invalid → force logout
    clearNurseToken();
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  // Some endpoints may return empty body
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

/**
 * ✅ Login helper
 * Backend endpoint: POST /api/auth/login
 * body: { username, password }
 * response: { token }
 */
export async function nurseLogin(username, password, { remember = true } = {}) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await handleResponse(res);

  const token = data?.token || "";
  if (!token) throw new Error("Login succeeded but no token returned.");

  setNurseToken(token, { remember });
  return token;
}