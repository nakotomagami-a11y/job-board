"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@lib/constants";
import { queryKeys } from "@shared/query-keys";

export interface TrackedCompany {
  name: string;
  careersUrl: string;
}

async function fetchCompanies(): Promise<TrackedCompany[]> {
  const res = await fetch(API.companies);
  if (!res.ok) throw new Error(`Failed to fetch companies: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useTrackedCompanies() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.companies,
    queryFn: fetchCompanies,
  });

  const save = useMutation({
    mutationFn: async (updated: TrackedCompany[]) => {
      const res = await fetch(API.companies, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to save companies");
      return updated;
    },
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: queryKeys.companies });
      const previous = qc.getQueryData<TrackedCompany[]>(queryKeys.companies);
      qc.setQueryData(queryKeys.companies, updated);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.companies, ctx.previous);
    },
  });

  return {
    companies: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    save: (next: TrackedCompany[]) => save.mutateAsync(next),
  };
}
