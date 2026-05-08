const BASE = import.meta.env.VITE_API_BASE;

const TOKEN_KEY = "nurse_token";

function getStorage(remember) {
  return remember ? window.localStorage : window.sessionStorage;
}

export function getNurseToken() {
  return (
    window.sessionStorage.getItem(TOKEN_KEY) ||
    window.localStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

export function setNurseToken(token, { remember = true } = {}) {
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
