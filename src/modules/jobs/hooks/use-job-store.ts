"use client";

import { useState, useEffect, useCallback } from "react";
import type { Job } from "@shared/types/job";
import { API } from "@lib/constants";

export function useJobStore() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(API.jobs);
      const data = await res.json();
      setJobs(data || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const addJobs = useCallback(
    async (newJobs: Job[]) => {
      const res = await fetch(API.jobs, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJobs),
      });
      const result = await res.json();
      if (result.added > 0) {
        await fetchJobs();
      }
      return result;
    },
    [fetchJobs]
  );

  const deleteJob = useCallback(
    async (id: string) => {
      await fetch(API.jobs, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    },
    []
  );

  const replaceAll = useCallback(
    async (newJobs: Job[]) => {
      await fetch(API.jobs, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJobs),
      });
      setJobs(newJobs);
    },
    []
  );

  return { jobs, loading, addJobs, deleteJob, replaceAll, refetch: fetchJobs };
}
