import { clearTokens, getAuthToken, getRefreshToken, storeAuthResponse } from "./auth-store.ts";

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = (await res.json()) as { authToken: string; refreshToken: string };
    storeAuthResponse(data);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

function refreshWithMutex(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const authToken = getAuthToken();

  const headers = new Headers(init?.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && authToken) {
    const refreshed = await refreshWithMutex();
    if (refreshed) {
      const newToken = getAuthToken();
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  return response;
}
