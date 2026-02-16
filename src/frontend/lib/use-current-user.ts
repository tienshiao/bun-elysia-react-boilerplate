import { useQuery } from "@tanstack/react-query";

import { api } from "./api.ts";
import { getAuthToken } from "./auth-store.ts";

interface CurrentUser {
  userId: string;
  username: string;
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      if (!getAuthToken()) return null;
      const { data, error } = await api.api.users.me.get();
      if (error) return null;
      return { userId: data.userId, username: data.username };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
