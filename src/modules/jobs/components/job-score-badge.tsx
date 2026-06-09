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
      className="flex items-center justify-center rounded-full shrink-0 text-[0.75rem] font-bold"
      style={{
        width: 38,
        height: 38,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `2px solid ${color}`,
        color,
      }}
    >
      {score}
    </div>
  );
}
