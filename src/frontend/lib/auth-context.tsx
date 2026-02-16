import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

import { api } from "./api.ts";
import { clearTokens, storeAuthResponse } from "./auth-store.ts";
import { useCurrentUser } from "./use-current-user.ts";

function extractErrorMessage(error: { status: number; value: unknown }, fallback: string): string {
  const val = error.value;
  if (val && typeof val === "object" && "error" in val && typeof val.error === "string") {
    return val.error;
  }
  // Elysia validation errors (422) have a different shape
  if (val && typeof val === "object" && "message" in val && typeof val.message === "string") {
    return val.message;
  }
  if (typeof val === "string") return val;
  return fallback;
}

interface AuthContextValue {
  user: { userId: string; username: string } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await api.api.auth["sign-in"].post({ email, password });
      if (error) throw new Error(extractErrorMessage(error, "Invalid credentials"));
      storeAuthResponse(data);
      queryClient.setQueryData(["currentUser"], {
        userId: data.user.userId,
        username: data.user.username,
      });
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const { data, error } = await api.api.auth["sign-up"].post({ email, password, username });
      if (error) throw new Error(extractErrorMessage(error, "Sign up failed"));
      storeAuthResponse(data);
      queryClient.setQueryData(["currentUser"], {
        userId: data.user.userId,
        username: data.user.username,
      });
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      await api.api.auth["sign-out"].post({ refreshToken }).catch(() => {});
    }
    clearTokens();
    queryClient.setQueryData(["currentUser"], null);
    queryClient.removeQueries({ queryKey: ["currentUser"] });
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
    }),
    [user, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
