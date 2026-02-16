export type TokenType = "auth" | "refresh" | "magic_link" | "password_reset";
export const TOKEN_TYPES = {
  auth: "auth",
  refresh: "refresh",
  magic_link: "magic_link",
  password_reset: "password_reset",
} as const;

export const AUTH_CONFIG = {
  authTokenTTL: 15 * 60, // 15 minutes (seconds)
  refreshTokenTTL: 90 * 24 * 60 * 60, // 90 days (seconds)
  refreshRenewThreshold: 7 * 24 * 60 * 60, // Renew refresh if < 7 days left
} as const;
