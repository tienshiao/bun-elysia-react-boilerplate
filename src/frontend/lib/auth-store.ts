const AUTH_TOKEN_KEY = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function storeAuthResponse(data: { authToken: string; refreshToken: string }): void {
  setAuthToken(data.authToken);
  setRefreshToken(data.refreshToken);
}
