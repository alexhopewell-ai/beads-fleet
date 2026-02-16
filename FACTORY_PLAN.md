# Factory Integration Plan

**Goal:** Extend beads_fleet to serve as the Cycle Apps Factory's dashboard

**Context:** The cycle-apps-factory project is building an autonomous iOS app factory. Rather than building a separate dashboard, we're extending beads_fleet with factory-specific features. See `factory-agent-prompt.md` and `agent_convo.md` for full background.

---

## Current State

beads_fleet already provides:
- Multi-project backlog with filtering
- "What's Next" priority intelligence
- Status tracking + Kanban board
- Token/cost tracking per issue
- Dependency graph analytics
- Multi-repo aggregation ("All Projects" view)
- Time travel diffs

## Gaps to Fill

### Phase 1: Read-Write Transition (Priority 2)
1. **Workflow action buttons** - Transform from read-only to actionable dashboard
   - Status change buttons (open -> in_progress -> closed)
   - "Approve & send to development" workflow action
   - "Request more research" action
   - Implementation: POST endpoints that shell out to `bd update`/`bd close` CLI commands

2. **Research report display** - Store and render research reports
   - Market analysis, competitor analysis, product research
   - Could use issue descriptions (already supported) or add a notes/attachments field
   - Markdown rendering for report content

### Phase 2: Factory Intelligence (Priority 3)
3. **Progress percentage bars** - Visual progress for epics
   - Calculate from child task completion ratio
   - Display on dashboard summary cards and kanban cards

4. **App Store submission tracking** - Post-build workflow
   - Submission date, review status, approval/rejection
   - Could be label-based workflow or custom fields

## Integration Points

- Factory registers new app projects via `POST /api/repos`
- Factory creates beads via `bd create` with labels like `research`, `development`, `kit-enhancement`
- Factory consumes APIs: `/api/issues`, `/api/insights`, `/api/priority`, `/api/token-usage`
- Feature requests filed as beads issues with `labels=factory-integration`

## Sequencing

Factory bootstrap work (pattern extraction, standards library) happens first and doesn't need any beads_fleet changes. The factory integration features become relevant when:
- Research agent is built (needs report display)
- First app build starts (needs workflow buttons)
- Multiple apps are in progress (needs progress bars)

This gives us time to build these features incrementally.
