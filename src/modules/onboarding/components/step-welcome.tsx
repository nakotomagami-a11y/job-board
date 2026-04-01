"use client";

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>
        Find your next role
      </h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.7 }}>
        JobHunt helps you find frontend and mobile dev jobs matched to your skills.
        Upload your CV, set your preferences, and browse curated positions.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          textAlign: "left",
          marginBottom: 20,
        }}
      >
        <h3
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--c-primary)",
            marginBottom: 12,
          }}
        >
          How it works
        </h3>
        <ul
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            lineHeight: 1.9,
            paddingLeft: 20,
          }}
        >
          <li>Upload your CV → we extract your skills automatically</li>
          <li>Set your preferences → region, role type, seniority, categories</li>
          <li>Browse jobs scored by how well they match your profile</li>
          <li>New jobs added regularly via Claude Code (ask it to run <code style={{ color: "var(--c-primary)", fontSize: "0.8rem" }}>CHECK_NEW_JOBS</code>)</li>
        </ul>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          textAlign: "left",
          marginBottom: 32,
        }}
      >
        <h3
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--c-secondary)",
            marginBottom: 12,
          }}
        >
          🔒 100% local, no accounts
        </h3>
        <ul
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            lineHeight: 1.8,
            paddingLeft: 20,
          }}
        >
          <li>Your CV and profile are stored on your machine only</li>
          <li>No external servers, no tracking, no sign-ups</li>
          <li>Optional: add a Claude API key in Settings for in-app AI search</li>
        </ul>
      </div>

      <button className="apply-btn" onClick={onNext} style={{ padding: "12px 32px", fontSize: "0.95rem" }}>
        Get Started →
      </button>
    </div>
  );
}
