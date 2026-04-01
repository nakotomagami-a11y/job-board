"use client";

import { JobBoard } from "@modules/jobs/components/job-board";
import { useJobStore } from "@modules/jobs/hooks/use-job-store";

export default function DashboardPage() {
  const { jobs, loading, refetch } = useJobStore();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--text-dim)",
        }}
      >
        Loading jobs...
      </div>
    );
  }

  return <JobBoard jobs={jobs} onRefresh={refetch} />;
}
