"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@lib/constants";
import { queryKeys } from "@shared/query-keys";

export interface Source {
  name: string;
  url: string;
  enabled: boolean;
}

async function fetchSources(): Promise<Source[]> {
  const res = await fetch(API.sources);
  if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useSources() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.sources,
    queryFn: fetchSources,
  });

  const save = useMutation({
    mutationFn: async (updated: Source[]) => {
      const res = await fetch(API.sources, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to save sources");
      return updated;
    },
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: queryKeys.sources });
      const previous = qc.getQueryData<Source[]>(queryKeys.sources);
      qc.setQueryData(queryKeys.sources, updated);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.sources, ctx.previous);
    },
  });

  return {
    sources: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    save: (next: Source[]) => save.mutateAsync(next),
  };
}
