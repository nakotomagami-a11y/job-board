"use client";

import { JobBoard } from "@modules/jobs/components/job-board";
import { useJobStore } from "@modules/jobs/hooks/use-job-store";

export default function DashboardPage() {
  const { jobs, loading, error, updateJob, refetch } = useJobStore();

  if (loading) {
    return (
      <div className="flex flex-col gap-3 items-center justify-center min-h-screen text-text-dim text-center px-6">
        Loading jobs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3 items-center justify-center min-h-screen text-text-dim text-center px-6">
        <div className="text-danger text-[0.95rem]">
          Couldn&apos;t load jobs
        </div>
        <div className="text-[0.78rem] text-text-dim max-w-[420px]">
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
        <button className="filter-btn" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return <JobBoard jobs={jobs} onRefresh={refetch} onUpdateJob={updateJob} />;
}
