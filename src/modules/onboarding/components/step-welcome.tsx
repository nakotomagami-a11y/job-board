"use client";

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="text-center">
      <div className="text-[3rem] mb-4">🎯</div>
      <h2 className="text-[1.5rem] font-bold mb-3">
        Find your next role
      </h2>
      <p className="text-text-muted mb-6 leading-[1.7]">
        JobHunt helps you find frontend and mobile dev jobs matched to your skills.
        Upload your CV, set your preferences, and browse curated positions.
      </p>

      <div className="bg-surface border border-border rounded-xl p-5 text-left mb-5">
        <h3 className="text-[0.85rem] font-semibold text-primary mb-3">
          How it works
        </h3>
        <ul className="text-text-muted text-[0.85rem] leading-[1.9] list-disc pl-5">
          <li>Upload your CV → we extract your skills automatically</li>
          <li>Set your preferences → region, role type, seniority, categories</li>
          <li>Browse jobs scored by how well they match your profile</li>
          <li>New jobs added regularly via Claude Code (ask it to run <code className="text-primary text-[0.8rem]">CHECK_NEW_JOBS</code>)</li>
        </ul>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 text-left mb-8">
        <h3 className="text-[0.85rem] font-semibold text-secondary mb-3">
          🔒 100% local, no accounts
        </h3>
        <ul className="text-text-muted text-[0.85rem] leading-[1.8] list-disc pl-5">
          <li>Your CV and profile are stored on your machine only</li>
          <li>No external servers, no tracking, no sign-ups</li>
          <li>Optional: add a Claude API key in Settings for in-app AI search</li>
        </ul>
      </div>

      <button className="apply-btn px-8 py-3 text-[0.95rem]" onClick={onNext}>
        Get Started →
      </button>
    </div>
  );
}
