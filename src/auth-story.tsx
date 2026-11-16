import { Code2, GitBranch, ScanLine, ShieldCheck } from "lucide-react";
import { AnimatedIcon } from "./motion-ui";
const steps = [
  {
    icon: Code2,
    title: "Start with your source",
    copy: "Snippets, files, or a repository.",
  },
  {
    icon: ScanLine,
    title: "Understand the evidence",
    copy: "Findings linked to the code behind them.",
  },
  {
    icon: ShieldCheck,
    title: "Keep the final say",
    copy: "Inspect and approve proposed changes.",
  },
];
export function AuthStory() {
  return (
    <aside className="auth-story">
      <span className="eyebrow">YOUR NEXT COMMIT, WITH CONFIDENCE</span>
      <h2>
        A little more context.
        <br />
        <span>A better next step.</span>
      </h2>
      <p>
        One focused place to explore your code, assess findings, and decide what
        happens next.
      </p>
      <div className="auth-story-list">
        {steps.map(({ icon, title, copy }) => (
          <div key={title}>
            <AnimatedIcon icon={icon} size={22} />
            <span>
              <strong>{title}</strong>
              <small>{copy}</small>
            </span>
          </div>
        ))}
      </div>
      <span className="auth-story-footer">
        <GitBranch size={16} />
        Built for thoughtful engineering.
      </span>
    </aside>
  );
}
