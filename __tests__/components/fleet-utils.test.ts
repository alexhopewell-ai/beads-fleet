// =============================================================================
// Tests for src/components/fleet/fleet-utils.ts — detectStage & buildFleetApps
// =============================================================================

import {
  detectStage,
  buildFleetApps,
  computeEpicCosts,
} from "@/components/fleet/fleet-utils";
import type { FleetApp, EpicCost, PhaseCost } from "@/components/fleet/fleet-utils";
import type { PlanIssue, IssueTokenSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helper: create a mock PlanIssue with sensible defaults
// ---------------------------------------------------------------------------

function makePlanIssue(overrides: Partial<PlanIssue> = {}): PlanIssue {
  return {
    id: overrides.id ?? "ISSUE-1",
    title: overrides.title ?? "Test issue",
    status: overrides.status ?? "open",
    priority: overrides.priority ?? 2,
    issue_type: overrides.issue_type ?? "task",
    blocked_by: overrides.blocked_by ?? [],
    blocks: overrides.blocks ?? [],
    ...overrides,
  };
}

// =============================================================================
// detectStage
// =============================================================================

describe("detectStage", () => {
  // ---------------------------------------------------------------------------
  // Completed — epic is closed
  // ---------------------------------------------------------------------------

  describe("completed stage", () => {
    it("returns 'completed' when the epic is closed", () => {
      const epic = makePlanIssue({ id: "E-1", status: "closed", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
      ];
      expect(detectStage(epic, children)).toBe("completed");
    });

    it("returns 'completed' when the epic is closed even with no children", () => {
      const epic = makePlanIssue({ id: "E-1", status: "closed", issue_type: "epic" });
      expect(detectStage(epic, [])).toBe("completed");
    });

    it("returns 'completed' regardless of children labels when epic is closed", () => {
      const epic = makePlanIssue({ id: "E-1", status: "closed", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["submission:ready"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("completed");
    });
  });

  // ---------------------------------------------------------------------------
  // Submission — any active child has submission:* label
  // ---------------------------------------------------------------------------

  describe("submission stage", () => {
    it("returns 'submission' when a child has a submission: label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["submission:ready"] }),
      ];
      expect(detectStage(epic, children)).toBe("submission");
    });

    it("returns 'submission' for any submission: prefix variant", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["submission:in-review"] }),
      ];
      expect(detectStage(epic, children)).toBe("submission");
    });

    it("returns 'submission' when mixed with development and research labels", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["development"] }),
        makePlanIssue({ id: "C-3", epic: "E-1", labels: ["submission:pending"] }),
      ];
      expect(detectStage(epic, children)).toBe("submission");
    });
  });

  // ---------------------------------------------------------------------------
  // Development — any non-closed child has "development" label
  // ---------------------------------------------------------------------------

  describe("development stage", () => {
    it("returns 'development' when a child has the development label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("development");
    });

    it("returns 'development' when mixed with research (development wins)", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("development");
    });
  });

  // ---------------------------------------------------------------------------
  // Research — any non-closed child has "research" label
  // ---------------------------------------------------------------------------

  describe("research stage", () => {
    it("returns 'research' when a child has the research label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
      ];
      expect(detectStage(epic, children)).toBe("research");
    });

    it("returns 'research' when children have research and unrelated labels", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research", "backend"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["infra"] }),
      ];
      expect(detectStage(epic, children)).toBe("research");
    });
  });

  // ---------------------------------------------------------------------------
  // Idea — default fallback
  // ---------------------------------------------------------------------------

  describe("idea stage (default)", () => {
    it("returns 'idea' when epic has no children", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      expect(detectStage(epic, [])).toBe("idea");
    });

    it("returns 'idea' when children have no matching labels", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["backend"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["infra"] }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });

    it("returns 'idea' when children have no labels at all", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1" }),
        makePlanIssue({ id: "C-2", epic: "E-1" }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });

    it("returns 'idea' when children have null labels", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: undefined }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });
  });

  // ---------------------------------------------------------------------------
  // Priority order: submission > development > research
  // ---------------------------------------------------------------------------

  describe("priority order", () => {
    it("submission takes priority over development", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["development"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["submission:beta"] }),
      ];
      expect(detectStage(epic, children)).toBe("submission");
    });

    it("submission takes priority over research", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["submission:review"] }),
      ];
      expect(detectStage(epic, children)).toBe("submission");
    });

    it("development takes priority over research", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", epic: "E-1", labels: ["research"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("development");
    });
  });

  // ---------------------------------------------------------------------------
  // Ignores closed children when detecting stage
  // ---------------------------------------------------------------------------

  describe("ignores closed children", () => {
    it("ignores a closed child with submission label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", status: "closed", epic: "E-1", labels: ["submission:done"] }),
        makePlanIssue({ id: "C-2", epic: "E-1", labels: ["research"] }),
      ];
      expect(detectStage(epic, children)).toBe("research");
    });

    it("ignores a closed child with development label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", status: "closed", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });

    it("ignores a closed child with research label", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", status: "closed", epic: "E-1", labels: ["research"] }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });

    it("falls back to idea when all labeled children are closed", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", status: "closed", epic: "E-1", labels: ["submission:done"] }),
        makePlanIssue({ id: "C-2", status: "closed", epic: "E-1", labels: ["development"] }),
        makePlanIssue({ id: "C-3", status: "closed", epic: "E-1", labels: ["research"] }),
      ];
      expect(detectStage(epic, children)).toBe("idea");
    });

    it("considers only open children for stage detection", () => {
      const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
      const children = [
        makePlanIssue({ id: "C-1", status: "closed", epic: "E-1", labels: ["submission:done"] }),
        makePlanIssue({ id: "C-2", status: "in_progress", epic: "E-1", labels: ["development"] }),
      ];
      expect(detectStage(epic, children)).toBe("development");
    });
  });
});

// =============================================================================
// buildFleetApps
// =============================================================================

describe("buildFleetApps", () => {
  // ---------------------------------------------------------------------------
  // Extracts only epic-type issues
  // ---------------------------------------------------------------------------

  describe("epic extraction", () => {
    it("extracts only epic-type issues", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", title: "App Alpha" }),
        makePlanIssue({ id: "T-1", issue_type: "task", title: "Task 1" }),
        makePlanIssue({ id: "B-1", issue_type: "bug", title: "Bug 1" }),
        makePlanIssue({ id: "F-1", issue_type: "feature", title: "Feature 1" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps).toHaveLength(1);
      expect(apps[0].epic.id).toBe("E-1");
    });

    it("extracts multiple epics", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", title: "App Alpha" }),
        makePlanIssue({ id: "E-2", issue_type: "epic", title: "App Beta" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps).toHaveLength(2);
      expect(apps.map((a) => a.epic.id).sort()).toEqual(["E-1", "E-2"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Returns empty array when no epics
  // ---------------------------------------------------------------------------

  describe("no epics", () => {
    it("returns empty array when no epics exist", () => {
      const issues = [
        makePlanIssue({ id: "T-1", issue_type: "task" }),
        makePlanIssue({ id: "B-1", issue_type: "bug" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps).toEqual([]);
    });

    it("returns empty array for empty input", () => {
      const apps = buildFleetApps([]);
      expect(apps).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Groups children correctly by epic
  // ---------------------------------------------------------------------------

  describe("children grouping", () => {
    it("groups children by their epic field", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", title: "Alpha" }),
        makePlanIssue({ id: "E-2", issue_type: "epic", title: "Beta" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1" }),
        makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1" }),
        makePlanIssue({ id: "T-3", issue_type: "task", epic: "E-2" }),
      ];
      const apps = buildFleetApps(issues);

      const alphaApp = apps.find((a) => a.epic.id === "E-1")!;
      const betaApp = apps.find((a) => a.epic.id === "E-2")!;

      expect(alphaApp.children).toHaveLength(2);
      expect(alphaApp.children.map((c) => c.id).sort()).toEqual(["T-1", "T-2"]);
      expect(betaApp.children).toHaveLength(1);
      expect(betaApp.children[0].id).toBe("T-3");
    });

    it("returns empty children for an epic with no child issues", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", title: "Lonely Epic" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].children).toEqual([]);
    });

    it("does not include issues without an epic field as children", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
        makePlanIssue({ id: "T-1", issue_type: "task" }), // no epic field
        makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].children).toHaveLength(1);
      expect(apps[0].children[0].id).toBe("T-2");
    });
  });

  // ---------------------------------------------------------------------------
  // Computes progress (closed / total children)
  // ---------------------------------------------------------------------------

  describe("progress computation", () => {
    it("computes progress with some closed children", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", status: "closed" }),
        makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", status: "open" }),
        makePlanIssue({ id: "T-3", issue_type: "task", epic: "E-1", status: "closed" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].progress).toEqual({ closed: 2, total: 3 });
    });

    it("computes progress with all children closed", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", status: "closed" }),
        makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", status: "closed" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].progress).toEqual({ closed: 2, total: 2 });
    });

    it("computes progress with no children closed", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", status: "open" }),
        makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", status: "in_progress" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].progress).toEqual({ closed: 0, total: 2 });
    });

    it("computes progress as 0/0 for an epic with no children", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].progress).toEqual({ closed: 0, total: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // Stage detection is wired correctly
  // ---------------------------------------------------------------------------

  describe("stage detection integration", () => {
    it("assigns the correct stage based on children labels", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["development"] }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].stage).toBe("development");
    });

    it("assigns 'completed' for a closed epic", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", status: "closed" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", status: "closed" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].stage).toBe("completed");
    });

    it("assigns 'idea' for an epic with no children", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic" }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps[0].stage).toBe("idea");
    });
  });

  // ---------------------------------------------------------------------------
  // Full FleetApp structure
  // ---------------------------------------------------------------------------

  describe("FleetApp structure", () => {
    it("returns objects with epic, children, stage, and progress fields", () => {
      const issues = [
        makePlanIssue({ id: "E-1", issue_type: "epic", title: "My App" }),
        makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] }),
      ];
      const apps = buildFleetApps(issues);
      expect(apps).toHaveLength(1);

      const app = apps[0];
      expect(app).toHaveProperty("epic");
      expect(app).toHaveProperty("children");
      expect(app).toHaveProperty("stage");
      expect(app).toHaveProperty("progress");
      expect(app.epic.id).toBe("E-1");
      expect(app.children).toHaveLength(1);
      expect(app.stage).toBe("research");
      expect(app.progress).toEqual({ closed: 0, total: 1 });
    });
  });
});

// =============================================================================
// computeEpicCosts (exercises classifyPhase indirectly)
// =============================================================================

// ---------------------------------------------------------------------------
// Helper: create a mock IssueTokenSummary with sensible defaults
// ---------------------------------------------------------------------------

function makeTokenSummary(
  overrides: Partial<IssueTokenSummary> & { issue_id: string },
): IssueTokenSummary {
  return {
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cache_read_tokens: 0,
    total_cache_creation_tokens: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    session_count: 0,
    total_duration_ms: 0,
    total_turns: 0,
    first_session: "2026-01-01T00:00:00Z",
    last_session: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Helper: build a FleetApp from an epic + children using buildFleetApps.
 * This ensures the FleetApp has stage/progress computed correctly.
 */
function makeFleetApp(epic: PlanIssue, children: PlanIssue[]): FleetApp {
  const all = [epic, ...children];
  const apps = buildFleetApps(all);
  return apps[0];
}

describe("computeEpicCosts", () => {
  // ---------------------------------------------------------------------------
  // 1. Returns empty map when no apps
  // ---------------------------------------------------------------------------

  it("returns empty map when no apps", () => {
    const result = computeEpicCosts([], {});
    expect(result.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. Returns empty map when no token usage data matches
  // ---------------------------------------------------------------------------

  it("returns empty map when no token usage data matches", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const child = makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] });
    const app = makeFleetApp(epic, [child]);

    // byIssue has data for unrelated issues only
    const byIssue: Record<string, IssueTokenSummary> = {
      "UNRELATED-1": makeTokenSummary({ issue_id: "UNRELATED-1", total_cost_usd: 5.0, session_count: 2 }),
    };

    const result = computeEpicCosts([app], byIssue);
    expect(result.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Aggregates cost from epic itself (attributed to "other" phase)
  // ---------------------------------------------------------------------------

  it("aggregates cost from epic itself attributed to 'other' phase", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const app = makeFleetApp(epic, []);

    const byIssue: Record<string, IssueTokenSummary> = {
      "E-1": makeTokenSummary({ issue_id: "E-1", total_cost_usd: 3.50, session_count: 4 }),
    };

    const result = computeEpicCosts([app], byIssue);
    expect(result.size).toBe(1);

    const cost = result.get("E-1")!;
    expect(cost.epicId).toBe("E-1");
    expect(cost.totalCost).toBeCloseTo(3.50);
    expect(cost.totalSessions).toBe(4);
    expect(cost.phases).toHaveLength(1);
    expect(cost.phases[0]).toEqual({ phase: "other", cost: 3.50, sessions: 4 });
  });

  // ---------------------------------------------------------------------------
  // 4. Aggregates cost from children by phase
  // ---------------------------------------------------------------------------

  it("aggregates cost from children by phase (research/development/submission/other)", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] }),
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", labels: ["development"] }),
      makePlanIssue({ id: "T-3", issue_type: "task", epic: "E-1", labels: ["submission:ready"] }),
      makePlanIssue({ id: "T-4", issue_type: "task", epic: "E-1", labels: ["infra"] }),
    ];
    const app = makeFleetApp(epic, children);

    const byIssue: Record<string, IssueTokenSummary> = {
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 1.0, session_count: 1 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 2.0, session_count: 2 }),
      "T-3": makeTokenSummary({ issue_id: "T-3", total_cost_usd: 3.0, session_count: 3 }),
      "T-4": makeTokenSummary({ issue_id: "T-4", total_cost_usd: 4.0, session_count: 4 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    // Find each phase
    const research = cost.phases.find((p) => p.phase === "research")!;
    const development = cost.phases.find((p) => p.phase === "development")!;
    const submission = cost.phases.find((p) => p.phase === "submission")!;
    const other = cost.phases.find((p) => p.phase === "other")!;

    expect(research).toEqual({ phase: "research", cost: 1.0, sessions: 1 });
    expect(development).toEqual({ phase: "development", cost: 2.0, sessions: 2 });
    expect(submission).toEqual({ phase: "submission", cost: 3.0, sessions: 3 });
    expect(other).toEqual({ phase: "other", cost: 4.0, sessions: 4 });
  });

  // ---------------------------------------------------------------------------
  // 5. Sums costs correctly across epic + children
  // ---------------------------------------------------------------------------

  it("sums costs correctly across epic and children", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] }),
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", labels: ["development"] }),
    ];
    const app = makeFleetApp(epic, children);

    const byIssue: Record<string, IssueTokenSummary> = {
      "E-1": makeTokenSummary({ issue_id: "E-1", total_cost_usd: 1.0, session_count: 1 }),
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 2.0, session_count: 3 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 4.0, session_count: 5 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    expect(cost.totalCost).toBeCloseTo(7.0); // 1 + 2 + 4
    expect(cost.totalSessions).toBe(9);      // 1 + 3 + 5
  });

  // ---------------------------------------------------------------------------
  // 6. Multiple phases per epic
  // ---------------------------------------------------------------------------

  it("handles multiple phases per epic correctly", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] }),
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", labels: ["research"] }),
      makePlanIssue({ id: "T-3", issue_type: "task", epic: "E-1", labels: ["development"] }),
    ];
    const app = makeFleetApp(epic, children);

    const byIssue: Record<string, IssueTokenSummary> = {
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 1.5, session_count: 2 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 2.5, session_count: 3 }),
      "T-3": makeTokenSummary({ issue_id: "T-3", total_cost_usd: 5.0, session_count: 7 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    expect(cost.phases).toHaveLength(2);

    const research = cost.phases.find((p) => p.phase === "research")!;
    expect(research.cost).toBeCloseTo(4.0);  // 1.5 + 2.5
    expect(research.sessions).toBe(5);       // 2 + 3

    const development = cost.phases.find((p) => p.phase === "development")!;
    expect(development.cost).toBeCloseTo(5.0);
    expect(development.sessions).toBe(7);
  });

  // ---------------------------------------------------------------------------
  // 7. Phase ordering: research, development, submission, other
  // ---------------------------------------------------------------------------

  it("orders phases as research, development, submission, other", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["infra"] }),          // other
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", labels: ["submission:beta"] }), // submission
      makePlanIssue({ id: "T-3", issue_type: "task", epic: "E-1", labels: ["development"] }),     // development
      makePlanIssue({ id: "T-4", issue_type: "task", epic: "E-1", labels: ["research"] }),        // research
    ];
    const app = makeFleetApp(epic, children);

    // Also add epic cost so "other" has two contributors
    const byIssue: Record<string, IssueTokenSummary> = {
      "E-1": makeTokenSummary({ issue_id: "E-1", total_cost_usd: 0.5, session_count: 1 }),
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 1.0, session_count: 1 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 2.0, session_count: 1 }),
      "T-3": makeTokenSummary({ issue_id: "T-3", total_cost_usd: 3.0, session_count: 1 }),
      "T-4": makeTokenSummary({ issue_id: "T-4", total_cost_usd: 4.0, session_count: 1 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    expect(cost.phases.map((p) => p.phase)).toEqual([
      "research",
      "development",
      "submission",
      "other",
    ]);
  });

  // ---------------------------------------------------------------------------
  // 8. Multiple epics with separate costs
  // ---------------------------------------------------------------------------

  it("handles multiple epics with separate costs", () => {
    const epic1 = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const epic2 = makePlanIssue({ id: "E-2", issue_type: "epic" });

    const child1 = makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["research"] });
    const child2 = makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-2", labels: ["development"] });

    const app1 = makeFleetApp(epic1, [child1]);
    const app2 = makeFleetApp(epic2, [child2]);

    const byIssue: Record<string, IssueTokenSummary> = {
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 10.0, session_count: 5 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 20.0, session_count: 8 }),
    };

    const result = computeEpicCosts([app1, app2], byIssue);
    expect(result.size).toBe(2);

    const cost1 = result.get("E-1")!;
    expect(cost1.epicId).toBe("E-1");
    expect(cost1.totalCost).toBeCloseTo(10.0);
    expect(cost1.totalSessions).toBe(5);
    expect(cost1.phases).toHaveLength(1);
    expect(cost1.phases[0].phase).toBe("research");

    const cost2 = result.get("E-2")!;
    expect(cost2.epicId).toBe("E-2");
    expect(cost2.totalCost).toBeCloseTo(20.0);
    expect(cost2.totalSessions).toBe(8);
    expect(cost2.phases).toHaveLength(1);
    expect(cost2.phases[0].phase).toBe("development");
  });

  // ---------------------------------------------------------------------------
  // 9. Child with submission:* label classified as "submission" phase
  // ---------------------------------------------------------------------------

  it("classifies child with submission:* label as 'submission' phase", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["submission:in-review"] }),
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1", labels: ["submission:ready"] }),
    ];
    const app = makeFleetApp(epic, children);

    const byIssue: Record<string, IssueTokenSummary> = {
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 1.0, session_count: 1 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 2.0, session_count: 2 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    expect(cost.phases).toHaveLength(1);
    expect(cost.phases[0].phase).toBe("submission");
    expect(cost.phases[0].cost).toBeCloseTo(3.0);
    expect(cost.phases[0].sessions).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // 10. Child with no matching labels classified as "other" phase
  // ---------------------------------------------------------------------------

  it("classifies child with no matching labels as 'other' phase", () => {
    const epic = makePlanIssue({ id: "E-1", issue_type: "epic" });
    const children = [
      makePlanIssue({ id: "T-1", issue_type: "task", epic: "E-1", labels: ["backend"] }),
      makePlanIssue({ id: "T-2", issue_type: "task", epic: "E-1" }),  // no labels at all
    ];
    const app = makeFleetApp(epic, children);

    const byIssue: Record<string, IssueTokenSummary> = {
      "T-1": makeTokenSummary({ issue_id: "T-1", total_cost_usd: 1.0, session_count: 1 }),
      "T-2": makeTokenSummary({ issue_id: "T-2", total_cost_usd: 2.0, session_count: 3 }),
    };

    const result = computeEpicCosts([app], byIssue);
    const cost = result.get("E-1")!;

    expect(cost.phases).toHaveLength(1);
    expect(cost.phases[0].phase).toBe("other");
    expect(cost.phases[0].cost).toBeCloseTo(3.0);
    expect(cost.phases[0].sessions).toBe(4);
  });
});
