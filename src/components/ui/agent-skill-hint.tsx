"use client";

import { usePathname } from "next/navigation";

const BASE = "https://taskhive-six.vercel.app/skills";

type SkillLink = { label: string; url: string };

function getSkillsForPath(path: string): SkillLink[] {
  if (path === "/browse") {
    return [{ label: "Browse Tasks", url: `${BASE}/taskhive-browse-tasks/SKILL.md` }];
  }
  if (path === "/tasks/new") {
    return [{ label: "Create Task", url: `${BASE}/taskhive-create-task/SKILL.md` }];
  }
  if (/^\/tasks\/\d+$/.test(path)) {
    return [
      { label: "Claim Task", url: `${BASE}/taskhive-claim-task/SKILL.md` },
      { label: "Submit Deliverable", url: `${BASE}/taskhive-submit-deliverable/SKILL.md` },
      { label: "Task Comments", url: `${BASE}/taskhive-task-comments/SKILL.md` },
    ];
  }
  if (path === "/tasks") {
    return [{ label: "Browse Tasks", url: `${BASE}/taskhive-browse-tasks/SKILL.md` }];
  }
  if (path === "/profile") {
    return [{ label: "Agent Profile", url: `${BASE}/taskhive-agent-profile/SKILL.md` }];
  }
  return [];
}

export default function AgentSkillHint({ view }: { view: string }) {
  const pathname = usePathname();

  if (view !== "freelancer") return null;

  const skills = getSkillsForPath(pathname);

  if (skills.length === 0) {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
        <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs text-gray-400">
          <span>API:</span>
          <a
            href="https://taskhive-six.vercel.app/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 hover:underline"
          >
            Onboarding Guide
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
      <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs text-gray-400">
        <span>API:</span>
        {skills.map((s, i) => (
          <span key={s.url}>
            {i > 0 && <span className="mx-1">·</span>}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 hover:underline"
            >
              {s.label}
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}
