"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@shared/types/job";
import { API } from "@lib/constants";
import { queryKeys } from "@shared/query-keys";

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(API.jobs);
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useJobStore() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.jobs,
    queryFn: fetchJobs,
  });

  const addJobs = useMutation({
    mutationFn: async (newJobs: Job[]) => {
      const res = await fetch(API.jobs, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJobs),
      });
      if (!res.ok) throw new Error("Failed to add jobs");
      return res.json();
    },
    onSuccess: (result) => {
      if (result?.added > 0) qc.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Job> }) => {
      const res = await fetch(API.jobs, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to update job");
      return { id, updates };
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs });
      const previous = qc.getQueryData<Job[]>(queryKeys.jobs);
      qc.setQueryData<Job[]>(queryKeys.jobs, (old) =>
        old ? old.map((j) => (j.id === id ? { ...j, ...updates } : j)) : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.jobs, ctx.previous);
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(API.jobs, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete job");
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.jobs });
      const previous = qc.getQueryData<Job[]>(queryKeys.jobs);
      qc.setQueryData<Job[]>(queryKeys.jobs, (old) =>
        old ? old.filter((j) => j.id !== id) : old
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.jobs, ctx.previous);
    },
  });

  const replaceAll = useMutation({
    mutationFn: async (newJobs: Job[]) => {
      const res = await fetch(API.jobs, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJobs),
      });
      if (!res.ok) throw new Error("Failed to replace jobs");
      return newJobs;
    },
    onSuccess: (newJobs) => {
      qc.setQueryData(queryKeys.jobs, newJobs);
    },
  });

  return {
    jobs: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    addJobs: (jobs: Job[]) => addJobs.mutateAsync(jobs),
    updateJob: async (id: string, updates: Partial<Job>): Promise<void> => {
      await updateJob.mutateAsync({ id, updates });
    },
    deleteJob: async (id: string): Promise<void> => {
      await deleteJob.mutateAsync(id);
    },
    replaceAll: async (jobs: Job[]): Promise<void> => {
      await replaceAll.mutateAsync(jobs);
    },
    refetch: async () => {
      await query.refetch();
    },
  };
}
