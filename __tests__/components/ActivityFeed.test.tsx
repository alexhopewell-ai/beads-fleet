// =============================================================================
// Tests for src/components/dashboard/ActivityFeed.tsx
// =============================================================================

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import type { RobotDiff, DiffIssueChange } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useDiff", () => ({
  useDiff: jest.fn(),
}));

import { useDiff } from "@/hooks/useDiff";

const mockUseDiff = useDiff as jest.MockedFunction<typeof useDiff>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDiff(overrides: Partial<RobotDiff> = {}): RobotDiff {
  return {
    timestamp: "2026-02-09T12:00:00Z",
    project_path: "/test/project",
    since_ref: "HEAD~10",
    new_count: 0,
    closed_count: 0,
    modified_count: 0,
    reopened_count: 0,
    changes: [],
    ...overrides,
  };
}

function makeChange(overrides: Partial<DiffIssueChange> = {}): DiffIssueChange {
  return {
    issue_id: "ISSUE-1",
    title: "Default test issue",
    change_type: "new",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActivityFeed", () => {
  beforeEach(() => {
    mockUseDiff.mockReset();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("loading state", () => {
    it("shows skeleton placeholders when isLoading is true", () => {
      mockUseDiff.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as ReturnType<typeof useDiff>);

      const { container } = render(<ActivityFeed />);

      expect(screen.getByText("Recent Changes")).toBeInTheDocument();
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Empty / missing data states
  // -------------------------------------------------------------------------

  describe("empty and missing data states", () => {
    it("shows 'No recent changes' when diff.changes is an empty array", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({ changes: [] }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });

    it("shows 'No recent changes' when diff.changes is undefined (crash bug)", () => {
      // This is the scenario that caused the TypeError crash on line 49:
      // diff is defined but diff.changes is undefined.
      const diffWithoutChanges = {
        timestamp: "2026-02-09T12:00:00Z",
        project_path: "/test/project",
        since_ref: "HEAD~10",
        new_count: 0,
        closed_count: 0,
        modified_count: 0,
        reopened_count: 0,
        // changes is intentionally omitted (undefined)
      } as unknown as RobotDiff;

      mockUseDiff.mockReturnValue({
        data: diffWithoutChanges,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);
      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });

    it("shows 'No recent changes' when diff data is null", () => {
      mockUseDiff.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });

    it("shows 'No recent changes' when diff data is undefined", () => {
      mockUseDiff.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe("error state", () => {
    it("shows 'No recent changes' when there is an error", () => {
      mockUseDiff.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("HTTP 500: Internal Server Error"),
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });

    it("shows 'No recent changes' when there is an error even with diff data", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [makeChange()],
          new_count: 1,
        }),
        isLoading: false,
        error: new Error("stale data"),
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("No recent changes")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Rendering changes with badges
  // -------------------------------------------------------------------------

  describe("with changes", () => {
    it("renders change items with issue IDs and titles", () => {
      const changes: DiffIssueChange[] = [
        makeChange({ issue_id: "BUG-42", title: "Login form broken", change_type: "new" }),
        makeChange({ issue_id: "FEAT-7", title: "Add dark mode", change_type: "closed" }),
      ];

      mockUseDiff.mockReturnValue({
        data: makeDiff({ changes, new_count: 1, closed_count: 1 }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("BUG-42")).toBeInTheDocument();
      expect(screen.getByText("Login form broken")).toBeInTheDocument();
      expect(screen.getByText("FEAT-7")).toBeInTheDocument();
      expect(screen.getByText("Add dark mode")).toBeInTheDocument();
    });

    it("renders NEW badge for new changes", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [makeChange({ change_type: "new" })],
          new_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("NEW")).toBeInTheDocument();
    });

    it("renders CLOSED badge for closed changes", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [makeChange({ change_type: "closed" })],
          closed_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("CLOSED")).toBeInTheDocument();
    });

    it("renders MODIFIED badge for modified changes", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [makeChange({ change_type: "modified" })],
          modified_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("MODIFIED")).toBeInTheDocument();
    });

    it("renders REOPENED badge for reopened changes", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [makeChange({ change_type: "reopened" })],
          reopened_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("REOPENED")).toBeInTheDocument();
    });

    it("renders all four badge types together", () => {
      const changes: DiffIssueChange[] = [
        makeChange({ issue_id: "A-1", change_type: "new" }),
        makeChange({ issue_id: "A-2", change_type: "closed" }),
        makeChange({ issue_id: "A-3", change_type: "modified" }),
        makeChange({ issue_id: "A-4", change_type: "reopened" }),
      ];

      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes,
          new_count: 1,
          closed_count: 1,
          modified_count: 1,
          reopened_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("NEW")).toBeInTheDocument();
      expect(screen.getByText("CLOSED")).toBeInTheDocument();
      expect(screen.getByText("MODIFIED")).toBeInTheDocument();
      expect(screen.getByText("REOPENED")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Truncation to 10 items
  // -------------------------------------------------------------------------

  describe("truncation", () => {
    it("only shows first 10 changes when there are more than 10", () => {
      const changes: DiffIssueChange[] = Array.from({ length: 15 }, (_, i) =>
        makeChange({
          issue_id: `ISSUE-${i + 1}`,
          title: `Issue number ${i + 1}`,
          change_type: "new",
        }),
      );

      mockUseDiff.mockReturnValue({
        data: makeDiff({ changes, new_count: 15 }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      const list = screen.getByRole("list");
      const items = list.querySelectorAll("li");
      expect(items).toHaveLength(10);

      // First 10 should be present
      expect(screen.getByText("ISSUE-1")).toBeInTheDocument();
      expect(screen.getByText("ISSUE-10")).toBeInTheDocument();

      // 11th through 15th should not be rendered
      expect(screen.queryByText("ISSUE-11")).not.toBeInTheDocument();
      expect(screen.queryByText("ISSUE-15")).not.toBeInTheDocument();
    });

    it("shows all changes when there are exactly 10", () => {
      const changes: DiffIssueChange[] = Array.from({ length: 10 }, (_, i) =>
        makeChange({
          issue_id: `ITEM-${i + 1}`,
          title: `Item number ${i + 1}`,
          change_type: "modified",
        }),
      );

      mockUseDiff.mockReturnValue({
        data: makeDiff({ changes, modified_count: 10 }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      const list = screen.getByRole("list");
      const items = list.querySelectorAll("li");
      expect(items).toHaveLength(10);
    });
  });

  // -------------------------------------------------------------------------
  // Summary counts
  // -------------------------------------------------------------------------

  describe("summary counts", () => {
    it("displays the correct summary text for new and closed counts", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [
            makeChange({ issue_id: "A-1", change_type: "new" }),
            makeChange({ issue_id: "A-2", change_type: "new" }),
            makeChange({ issue_id: "A-3", change_type: "closed" }),
          ],
          new_count: 2,
          closed_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("+2 new, 1 closed")).toBeInTheDocument();
    });

    it("displays summary with all four count types", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [
            makeChange({ issue_id: "A-1", change_type: "new" }),
            makeChange({ issue_id: "A-2", change_type: "closed" }),
            makeChange({ issue_id: "A-3", change_type: "modified" }),
            makeChange({ issue_id: "A-4", change_type: "reopened" }),
          ],
          new_count: 1,
          closed_count: 1,
          modified_count: 1,
          reopened_count: 1,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(
        screen.getByText("+1 new, 1 closed, 1 modified, 1 reopened"),
      ).toBeInTheDocument();
    });

    it("omits zero counts from summary text", () => {
      mockUseDiff.mockReturnValue({
        data: makeDiff({
          changes: [
            makeChange({ issue_id: "A-1", change_type: "modified" }),
            makeChange({ issue_id: "A-2", change_type: "modified" }),
            makeChange({ issue_id: "A-3", change_type: "modified" }),
          ],
          new_count: 0,
          closed_count: 0,
          modified_count: 3,
          reopened_count: 0,
        }),
        isLoading: false,
        error: null,
      } as ReturnType<typeof useDiff>);

      render(<ActivityFeed />);

      expect(screen.getByText("3 modified")).toBeInTheDocument();
      // Ensure zero-count categories are not in the summary
      expect(screen.queryByText(/new/)).not.toBeInTheDocument();
      expect(screen.queryByText(/closed/)).not.toBeInTheDocument();
      expect(screen.queryByText(/reopened/)).not.toBeInTheDocument();
    });
  });
});
