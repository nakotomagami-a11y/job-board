"use client";

import { JobBoard } from "@modules/jobs/components/job-board";
import { useJobStore } from "@modules/jobs/hooks/use-job-store";

const centeredScreen: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  color: "var(--text-dim)",
  textAlign: "center",
  padding: "0 24px",
};

export default function DashboardPage() {
  const { jobs, loading, error, updateJob, refetch } = useJobStore();

  if (loading) {
    return <div style={centeredScreen}>Loading jobs...</div>;
  }

  if (error) {
    return (
      <div style={centeredScreen}>
        <div style={{ color: "#f87171", fontSize: "0.95rem" }}>
          Couldn&apos;t load jobs
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", maxWidth: 420 }}>
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
