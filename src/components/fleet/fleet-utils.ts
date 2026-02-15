import type { PlanIssue, IssueTokenSummary } from "@/lib/types";

/** Pipeline stages for the factory fleet view. */
export type FleetStage =
  | "idea"
  | "research"
  | "development"
  | "submission"
  | "completed";

export const FLEET_STAGES: FleetStage[] = [
  "idea",
  "research",
  "development",
  "submission",
  "completed",
];

export const FLEET_STAGE_CONFIG: Record<
  FleetStage,
  { label: string; color: string; dotColor: string }
> = {
  idea: { label: "Idea", color: "text-gray-400", dotColor: "bg-gray-400" },
  research: {
    label: "Research",
    color: "text-blue-400",
    dotColor: "bg-blue-400",
  },
  development: {
    label: "Development",
    color: "text-amber-400",
    dotColor: "bg-amber-400",
  },
  submission: {
    label: "Submission",
    color: "text-purple-400",
    dotColor: "bg-purple-400",
  },
  completed: {
    label: "Completed",
    color: "text-green-400",
    dotColor: "bg-green-400",
  },
};

export interface FleetApp {
  epic: PlanIssue;
  children: PlanIssue[];
  stage: FleetStage;
  progress: { closed: number; total: number };
}

/**
 * Determine which pipeline stage an epic is in based on its children's labels and statuses.
 *
 * Priority (highest active stage wins):
 * 1. Completed — epic is closed
 * 2. Submission — any child has a submission:* label and is not closed
 * 3. Development — any non-closed child has "development" label
 * 4. Research — any non-closed child has "research" label
 * 5. Idea — default (new epic, no matching children)
 */
export function detectStage(
  epic: PlanIssue,
  children: PlanIssue[],
): FleetStage {
  if (epic.status === "closed") return "completed";

  const activeChildren = children.filter((c) => c.status !== "closed");

  const hasSubmission = activeChildren.some(
    (c) => c.labels?.some((l) => l.startsWith("submission:")) ?? false,
  );
  if (hasSubmission) return "submission";

  const hasDevelopment = activeChildren.some(
    (c) => c.labels?.includes("development") ?? false,
  );
  if (hasDevelopment) return "development";

  const hasResearch = activeChildren.some(
    (c) => c.labels?.includes("research") ?? false,
  );
  if (hasResearch) return "research";

  return "idea";
}

/**
 * Extract fleet apps from the full issue list.
 * An "app" is any epic-type issue.
 */
// ---------------------------------------------------------------------------
// Cost per app — aggregate token usage by epic with phase breakdown
// ---------------------------------------------------------------------------

export interface PhaseCost {
  phase: string;
  cost: number;
  sessions: number;
}

export interface EpicCost {
  epicId: string;
  totalCost: number;
  totalSessions: number;
  phases: PhaseCost[];
}

/**
 * Determine the phase of an issue based on its labels.
 * Returns "research", "development", "submission", or "other".
 */
function classifyPhase(issue: PlanIssue): string {
  if (issue.labels?.some((l) => l.startsWith("submission:"))) return "submission";
  if (issue.labels?.includes("development")) return "development";
  if (issue.labels?.includes("research")) return "research";
  return "other";
}

/**
 * Compute per-epic cost breakdowns from token usage summaries.
 *
 * For each epic, sums up token costs from:
 * - The epic issue itself (work attributed directly to the epic)
 * - All child issues, grouped by phase (research/development/submission/other)
 */
export function computeEpicCosts(
  apps: FleetApp[],
  byIssue: Record<string, IssueTokenSummary>,
): Map<string, EpicCost> {
  const result = new Map<string, EpicCost>();

  for (const app of apps) {
    const phaseMap = new Map<string, PhaseCost>();
    let totalCost = 0;
    let totalSessions = 0;

    // Cost attributed directly to the epic
    const epicUsage = byIssue[app.epic.id];
    if (epicUsage) {
      totalCost += epicUsage.total_cost_usd;
      totalSessions += epicUsage.session_count;
      const phase = "other";
      const existing = phaseMap.get(phase);
      if (existing) {
        existing.cost += epicUsage.total_cost_usd;
        existing.sessions += epicUsage.session_count;
      } else {
        phaseMap.set(phase, { phase, cost: epicUsage.total_cost_usd, sessions: epicUsage.session_count });
      }
    }

    // Cost from children, grouped by phase
    for (const child of app.children) {
      const childUsage = byIssue[child.id];
      if (!childUsage) continue;

      totalCost += childUsage.total_cost_usd;
      totalSessions += childUsage.session_count;

      const phase = classifyPhase(child);
      const existing = phaseMap.get(phase);
      if (existing) {
        existing.cost += childUsage.total_cost_usd;
        existing.sessions += childUsage.session_count;
      } else {
        phaseMap.set(phase, { phase, cost: childUsage.total_cost_usd, sessions: childUsage.session_count });
      }
    }

    if (totalCost > 0 || totalSessions > 0) {
      // Sort phases in pipeline order
      const phaseOrder = ["research", "development", "submission", "other"];
      const phases = phaseOrder
        .filter((p) => phaseMap.has(p))
        .map((p) => phaseMap.get(p)!);

      result.set(app.epic.id, { epicId: app.epic.id, totalCost, totalSessions, phases });
    }
  }

  return result;
}

export function buildFleetApps(allIssues: PlanIssue[]): FleetApp[] {
  const epics = allIssues.filter((i) => i.issue_type === "epic");

  return epics.map((epic) => {
    const children = allIssues.filter((i) => i.epic === epic.id);
    const stage = detectStage(epic, children);
    const closed = children.filter((c) => c.status === "closed").length;
    return {
      epic,
      children,
      stage,
      progress: { closed, total: children.length },
    };
  });
}
