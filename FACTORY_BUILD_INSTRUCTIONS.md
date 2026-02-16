# Factory Integration: Build Instructions

**For:** A new agent working in the beads_fleet repo
**From:** The cycle-apps-factory agent
**Date:** 2026-02-15

---

## Context

The Cycle Apps Factory is an autonomous iOS app-building system. It uses
beads for all task tracking. Rather than building a separate dashboard,
we're extending beads_fleet with 4 factory-specific features.

**The factory is operational.** Bootstrap is complete. The research agent
produces reports at `apps/<app-name>/research/report.md` in the factory
repo. The next step is building Jane's first app, and these features will
make that workflow smoother.

**Background docs (already in this repo):**
- `FACTORY_PLAN.md` — How the factory and beads_fleet collaborate
- `FACTORY_INTEGRATION_PLAN.md` — Detailed integration proposal
- `ARCHITECTURE.md` — Current beads_fleet system architecture

---

## What to Build

### Feature 1: Workflow Action Buttons (bw-270, P2)

**What:** Transform beads_fleet from read-only to actionable. Add buttons
that change issue status via the `bd` CLI.

**Where:** Issue detail page (`src/app/issue/[id]/page.tsx`) and
optionally kanban cards.

**Implementation:**

1. Add a new API route: `POST /api/issues/[id]/action`
   - Body: `{ "action": "start" | "close" | "reopen", "reason"?: string }`
   - Implementation: shell out to `bd update <id> --status=<status>` or
     `bd close <id> --reason="..."`
   - Use `execFile` (not `exec`) for security, matching existing patterns
   - Return updated issue data

2. Add action buttons to issue detail page:
   - **Open issue:** "Start Work" button → sets status to `in_progress`
   - **In-progress issue:** "Close" button → opens modal for close reason
   - **Closed issue:** "Reopen" button → sets status to `open`
   - Factory-specific (when issue has `factory-integration` or `research` label):
     - "Approve & Send to Development" → closes research task with approval reason
     - "Request More Research" → adds comment, keeps status

3. Invalidate TanStack Query cache after mutation so UI updates immediately.

**Constraints:**
- Follow existing patterns in `src/lib/bv-client.ts` for CLI interaction
- Use `execFile` with argument arrays, never `exec` with string interpolation
- Validate issue ID format before passing to CLI

---

### Feature 2: Research Report Display (bw-ctu, P2)

**What:** Display research reports that the factory's research agent
produces. These are markdown files at predictable paths in the factory repo.

**Where:** Issue detail page, or a new `/research/[app-name]` page.

**Implementation:**

1. Add a new API route: `GET /api/research/[app-name]`
   - Reads `<factory-repo>/apps/<app-name>/research/report.md`
   - Factory repo path: get from `~/.beads-web.json` repo config
     (look for repo named "CycleAppsFactory" or similar)
   - Returns raw markdown content
   - 404 if report doesn't exist yet

2. Add markdown rendering component:
   - Use a lightweight markdown renderer (e.g., `react-markdown` or
     `next-mdx-remote`)
   - Render in a panel/card on the issue detail page when the issue
     has a `research` label
   - Or create a dedicated page at `/research/[app-name]`

3. Report structure (what the research agent produces):
   - Executive Summary
   - Market Analysis (demographics, size, saturation)
   - Competitor Analysis (table + profiles)
   - Domain Knowledge
   - Design Recommendations (with standards override proposals)
   - Feature Plan (MVP + v2 + rejected)
   - CycleKit Integration Plan
   - App Store Strategy
   - Risks & Mitigations
   - Go/No-Go Recommendation

**Constraints:**
- Reports are read-only in beads_fleet (the factory agent writes them)
- Handle the case where no report exists yet (show placeholder)
- Reports can be large (500+ lines) — consider collapsible sections

---

### Feature 3: Progress Percentage Bars (bw-nbv, P3)

**What:** Show completion percentage for epics based on child task status.

**Where:** Dashboard cards, kanban cards, issue detail page for epics.

**Implementation:**

1. Calculate progress from existing data:
   - An epic's progress = `closed_children / total_children * 100`
   - Use the dependency graph or issue hierarchy to find children
   - Beads uses `blocks`/`blocked_by` relationships — an epic "blocks"
     its subtasks (or subtasks are "blocked_by" the epic)
   - Alternative: use label matching (e.g., all issues with label
     "LensCycle" under the "LensCycle" epic)

2. Add progress bar component:
   - Simple horizontal bar with percentage label
   - Color: use existing status colors (green for complete, blue for
     in-progress, gray for not started)
   - Show on IssueCard when issue type is `epic`

3. Add to dashboard summary if applicable.

**Constraints:**
- This only applies to epic-type issues
- Handle edge cases: epic with 0 children (show 0%), all closed (100%)
- Consider caching the calculation (it requires reading multiple issues)

---

### Feature 4: App Store Submission Tracking (bw-yq1, P3)

**What:** Track App Store submission lifecycle for completed apps.

**Where:** Issue detail page for submission-type issues, dashboard summary.

**Implementation:**

1. Use beads labels for submission status workflow:
   - `submission-preparing` → building for TestFlight
   - `submission-review` → submitted, in Apple review
   - `submission-approved` → approved, live on App Store
   - `submission-rejected` → rejected, needs changes

2. Display submission status on issue detail:
   - Show current status with appropriate icon/color
   - Show timeline: submitted → reviewing → approved/rejected
   - Show dates for each transition (from issue update history)

3. Add to dashboard:
   - Count of apps by submission status
   - "In Review" badge on relevant cards

**Constraints:**
- This is the lowest priority feature — build only after the others work
- Keep it label-based (no schema changes to beads)
- The factory agent will set these labels via `bd update --labels`

---

## Technical Notes

**Existing patterns to follow:**
- API routes: see `src/app/api/issues/route.ts` for the GET pattern
- CLI interaction: see `src/lib/bv-client.ts` for `execFile` usage
- Components: see `src/components/` for existing card/layout patterns
- Hooks: see `src/hooks/useIssues.ts` for TanStack Query patterns
- Styling: Tailwind CSS with dark mode, see `globals.css` for custom colors

**Dependencies you may need to add:**
- `react-markdown` + `remark-gfm` for research report rendering
- Or use `@next/mdx` if you prefer build-time MDX processing

**Testing:**
- Follow existing test patterns in `__tests__/`
- API routes: test with mock `execFile` responses
- Components: React Testing Library

**ARCHITECTURE.md rule:**
Per `CLAUDE.md`, you MUST update `ARCHITECTURE.md` whenever you add pages,
API routes, hooks, components, or change data flow. Do this in the same
commit as the code change.

---

## Suggested Build Order

1. **bw-270** (Workflow action buttons) — most impactful, enables Jane
   to interact with factory issues from the dashboard
2. **bw-ctu** (Research report display) — needed when first app research
   is complete
3. **bw-nbv** (Progress bars) — nice-to-have for tracking multi-step builds
4. **bw-yq1** (Submission tracking) — only needed when apps reach submission

---

## How to Verify

After building each feature:

1. Start beads_fleet: `npm run dev`
2. Open http://localhost:3000
3. Navigate to a factory issue (from cycle-apps-factory project)
4. Verify the feature works as described

For the research report feature, you can create a test report:
```bash
mkdir -p /Users/janemckay/dev/claude_projects/cycle-apps-factory/apps/TestApp/research
echo "# TestApp Research Report\n\nTest content." > \
  /Users/janemckay/dev/claude_projects/cycle-apps-factory/apps/TestApp/research/report.md
```

---

## Questions?

If anything is unclear, check:
- `FACTORY_PLAN.md` in this repo — full factory-to-beads_fleet collaboration plan
- `FACTORY_INTEGRATION_PLAN.md` in this repo — detailed integration proposal
- The 4 beads: `bd show bw-ctu`, `bd show bw-270`, `bd show bw-nbv`, `bd show bw-yq1`
- Factory standards: `/Users/janemckay/dev/claude_projects/cycle-apps-factory/standards/`
