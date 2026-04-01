"use client";

interface JobScoreBadgeProps {
  score: number;
}

export function JobScoreBadge({ score }: JobScoreBadgeProps) {
  const color =
    score >= 75
      ? "var(--c-secondary)"
      : score >= 50
        ? "var(--c-accent)"
        : "var(--text-dim)";

  return (
    <div
      title={`Match score: ${score}/100`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `2px solid ${color}`,
        color,
        fontSize: "0.75rem",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}
