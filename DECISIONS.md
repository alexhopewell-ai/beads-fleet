# beads_fleet Decisions Log

**Decisions affecting this project**

---

## Decision 1: Extend beads_fleet for Factory Integration
**Date:** 2026-02-15
**Decision:** Extend beads_fleet with factory-specific features rather than the factory building a separate dashboard
**Reasoning:**
- beads_fleet already provides ~80% of what the factory's COMPLETE_SYSTEM.md designed from scratch
- Existing features: multi-project backlog, priority intelligence, status tracking, kanban, token/cost tracking, dependency analytics
- Four gaps to fill: research report display, workflow action buttons, progress bars, App Store tracking
- One great dashboard beats two competing ones
- Jane already uses beads_fleet daily
**Requested by:** Factory agent (cycle-apps-factory), approved by Jane
**Tracking:** Issues labeled `factory-integration` in this repo
**Status:** Active

---

## Decision 2: Single Agent Cross-Repo Model
**Date:** 2026-02-15
**Decision:** The factory agent works directly in the beads_fleet repo when needed, rather than coordinating with a separate beads_fleet agent
**Reasoning:**
- Claude Code agents can't communicate in real time (each session is isolated)
- Previous inter-agent communication required Jane to manually relay messages
- Single agent working across both repos eliminates coordination overhead
- Gastown (Mayor + workers) would be the proper multi-agent solution but isn't installed yet
**Revisit when:** Gastown is installed for 5+ app parallel development
**Status:** Active
