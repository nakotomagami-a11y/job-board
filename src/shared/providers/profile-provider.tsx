"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserProfile } from "@shared/types/profile";
import { DEFAULT_PROFILE } from "@shared/types/profile";
import { API } from "@lib/constants";
import { queryKeys } from "@shared/query-keys";

interface ProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  loading: true,
  updateProfile: async () => {},
  refetch: async () => {},
});

async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch(API.profile);
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  const data = await res.json();
  return data || DEFAULT_PROFILE;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const current = qc.getQueryData<UserProfile>(queryKeys.profile) ?? DEFAULT_PROFILE;
      const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
      const res = await fetch(API.profile, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return next;
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: queryKeys.profile });
      const previous = qc.getQueryData<UserProfile>(queryKeys.profile);
      qc.setQueryData<UserProfile>(queryKeys.profile, (old) => ({
        ...(old ?? DEFAULT_PROFILE),
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.profile, ctx.previous);
    },
  });

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      await mutation.mutateAsync(updates);
    },
    [mutation]
  );

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return (
    <ProfileContext.Provider
      value={{
        profile: query.data ?? null,
        loading: query.isLoading,
        updateProfile,
        refetch,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
