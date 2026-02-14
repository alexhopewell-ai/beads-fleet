# Beads Web Architecture

> **Keep this document current.** Update it whenever features, data flows, APIs, or file structure change. Agents working on this codebase depend on it for context.

## What This Is

A Next.js 14 dark-themed web dashboard for the **Beads** git-backed issue tracker. It visualizes issues, dependencies, graph analytics, token usage, and project health across multiple beads-enabled repositories.

**Tech stack:** Next.js 14, React 18, TanStack React Query 5, ReactFlow 11, better-sqlite3, Tailwind CSS 3, TypeScript 5.

## Data Flow

```
.beads/beads.db (SQLite)   ─┐
.beads/issues.jsonl         ─┤── sqlite-reader.ts / jsonl-fallback.ts ──┐
.beads/token-usage.jsonl    ─┘                                          │
                                                                        v
bv CLI (--robot-plan/insights/priority/diff)                            │
        │                                                               │
        v                                                               v
  bv-client.ts  <── graph-metrics.ts (fallback analytics)
  (normalizes bv output + 10s TTL cache)
        │
        v
  API Routes (src/app/api/**)
        │
        v
  React Hooks (useIssues, useInsights, etc.)
  (TanStack Query, 15s stale, 30-60s polling)
        │
        v
  UI Components (pages, dashboard, board, insights)
```

**Fallback chain:** bv CLI -> SQLite DB -> JSONL file -> empty response. The app works without `bv` installed.

**Multi-repo aggregation:** When `activeRepo === "__all__"`, API routes fetch each repo's data in parallel, merge results, and add `project:<repoName>` labels for filtering.

## Pages

| Route | Page | What It Shows |
|-------|------|---------------|
| `/` | Dashboard | Summary cards (open/in_progress/blocked/closed counts), token usage totals, highest-impact issue, priority misalignment alerts, full issue table with sort/filter, recent activity feed |
| `/board` | Kanban Board | Issues grouped by status columns (open, in_progress, blocked, closed), click-to-open detail panel |
| `/insights` | Graph Analytics | Bottlenecks, keystones, influencers, hubs, authorities (top-5 bar charts), dependency cycles, graph density, interactive ReactFlow dependency graph |
| `/diff` | Time Travel | Compare current state against a git ref (HEAD~1/5/10/20 or custom), shows new/closed/modified/reopened issues with field-level diffs |
| `/settings` | Settings | Add/remove/switch repos, stored in `~/.beads-web.json` |
| `/issue/[id]` | Issue Detail | Full issue: description, dependency tree, status/priority/owner/labels, token usage per session |

## API Routes

| Endpoint | Method | Returns | Notes |
|----------|--------|---------|-------|
| `/api/issues` | GET | `RobotPlan` (all_issues, tracks, summary) | Supports `__all__` aggregation |
| `/api/issues/[id]` | GET | `{ plan_issue, raw_issue }` | Single issue with raw JSONL data |
| `/api/insights` | GET | `RobotInsights` (bottlenecks, keystones, etc.) | Graph metrics |
| `/api/priority` | GET | `RobotPriority` (recommendations[]) | Priority misalignment detection |
| `/api/diff?since=REF` | GET | `RobotDiff` (changes[]) | Git ref validated against safe pattern |
| `/api/health` | GET | `{ bv_available, project_path, project_valid }` | System health check |
| `/api/repos` | GET | `RepoStore` (repos[], activeRepo) | Repo config |
| `/api/repos` | POST | `RepoStore` | Body: `{ action: "add"\|"remove"\|"set-active", path, name? }` |
| `/api/token-usage` | GET | `TokenUsageRecord[]` or summary | Params: `summary=true`, `issue_id=X`. Supports `__all__` |

## Core Library Modules

### `src/lib/bv-client.ts` (central data layer)
Wraps `bv --robot-*` CLI commands via `execFile`. Normalizes PascalCase bv output to TypeScript types. 10-second TTL cache. Falls back to SQLite/JSONL when bv unavailable.

Key exports:
- `getPlan(projectPath?)` -> `RobotPlan`
- `getInsights(projectPath?)` -> `RobotInsights`
- `getPriority(projectPath?)` -> `RobotPriority`
- `getDiff(since, projectPath?)` -> `RobotDiff`
- `getIssueById(issueId, projectPath?)` -> `{ plan_issue, raw_issue }`
- `getAllProjectsPlan(repoPaths)` -> merged `RobotPlan` with `project:` labels
- `invalidateCache()` -> clears all cached responses

### `src/lib/sqlite-reader.ts`
Reads `.beads/beads.db` via `better-sqlite3` (readonly). Dynamically detects optional columns (e.g. `story_points`) via `PRAGMA table_info` to handle schema differences across beads versions. Returns `null` if DB missing (triggers JSONL fallback).

### `src/lib/jsonl-fallback.ts`
- `readIssuesFromJSONL(projectPath)` -> tries SQLite first, then `.beads/issues.jsonl`
- `issuesToPlan(issues, projectPath)` -> converts `BeadsIssue[]` to `RobotPlan` with dependency cross-references

### `src/lib/graph-metrics.ts`
Computes approximate graph metrics when bv unavailable: betweenness centrality (bottlenecks), transitive unblock count (keystones), degree centrality (hubs/authorities/influencers), Tarjan's SCC (cycles).

### `src/lib/repo-config.ts`
Manages `~/.beads-web.json`. `ALL_PROJECTS_SENTINEL = "__all__"` enables aggregation mode. Exports: `getActiveProjectPath()`, `getAllRepoPaths()`, `addRepo()`, `removeRepo()`, `setActiveRepo()`, `getRepos()`.

### `src/lib/recipes.ts`
Filter engine. `FilterCriteria` supports: statuses, priorities, types, owner, labels, projects, epic, hasBlockers, isStale, isRecent, search text. Built-in views: All Issues, Actionable, In Progress, Blocked, High Priority, Bugs. Custom views saved to localStorage.

### `src/lib/token-usage.ts`
Reads `.beads/token-usage.jsonl`. Provides raw records and per-issue aggregated summaries (tokens, cost, sessions, duration, turns).

### `src/lib/cache.ts`
Simple TTL cache (10-second default). Used by bv-client to avoid redundant subprocess calls.

### `src/lib/types.ts`
All TypeScript types:
- **Core:** `BeadsIssue`, `IssueDependency`, `IssueStatus`, `IssueType`, `Priority` (0-4)
- **Robot protocol:** `RobotPlan`, `RobotInsights`, `RobotPriority`, `RobotDiff`, `PlanIssue`, `PlanSummary`, `PlanTrack`
- **UI config:** `STATUS_CONFIG`, `PRIORITY_CONFIG`, `KANBAN_COLUMNS`
- **Token:** `TokenUsageRecord`, `IssueTokenSummary`

## React Hooks

| Hook | Fetches | Polling |
|------|---------|---------|
| `useIssues()` | `/api/issues` -> `RobotPlan` | 30s |
| `useIssueDetail(id)` | `/api/issues/[id]` | 30s |
| `useInsights()` | `/api/insights` -> `RobotInsights` | 60s |
| `usePriority()` | `/api/priority` -> `RobotPriority` | 60s |
| `useDiff(since)` | `/api/diff?since=X` -> `RobotDiff` | none |
| `useHealth()` | `/api/health` | 60s |
| `useRepos()` | `/api/repos` -> `RepoStore` | none (60s stale) |
| `useRepoMutation()` | POST `/api/repos` | invalidates all queries |
| `useTokenUsage(issueId?)` | `/api/token-usage` | 60s |
| `useTokenUsageSummary()` | `/api/token-usage?summary=true` | 60s |
| `useKeyboardShortcuts()` | -- | d/b/i/t/s navigation, / search, ? help |

## Component Tree

```
layout.tsx (server)
  QueryProvider
    ClientShell (ErrorBoundary + SetupWizard + ShortcutsHelp)
      Sidebar (nav links, RepoSelector, health indicator)
      Header (breadcrumb with project selector dropdown)
      <main> (page content)
```

### Key Components
- **Dashboard:** `SummaryCards`, `TokenUsageSummary`, `WhatsNext`, `PriorityAlerts`, `IssueTable` (with `FilterBar`), `ActivityFeed`
- **Board:** `KanbanBoard` -> `KanbanColumn` -> `IssueCard`, `IssueDetailPanel` (slide-in)
- **Insights:** `MetricPanel` (bar charts), `CyclesPanel`, `GraphDensityBadge`, `DependencyGraph` (ReactFlow)
- **Filters:** `FilterBar`, `RecipeSelector`
- **UI primitives:** `StatusBadge`, `PriorityIndicator`, `IssueTypeIcon`, `SummaryCard`, `IssueCard` (row/card variants), `EmptyState`, `ErrorState`, `LoadingSkeleton`

## Multi-Repo Support

Config stored in `~/.beads-web.json`:
```json
{
  "repos": [
    { "name": "PatchCycle", "path": "/path/to/PatchCycle" },
    { "name": "beads_web", "path": "/path/to/beads_web" }
  ],
  "activeRepo": "/path/to/PatchCycle"  // or "__all__" for aggregation
}
```

- Header shows project selector dropdown when 2+ repos configured
- "All Projects" option sets `activeRepo` to `"__all__"`
- API routes detect `__all__` and aggregate across all repo paths
- Issues get `project:<repoName>` labels for filtering in the UI
- `useRepoMutation()` invalidates all data queries on project switch

## Design System

Dark mode with 4-tier surface palette:
- `surface-0` (#0f1117) -> `surface-3` (#2f323c)
- Status colors: open (green), progress (amber), blocked (red), closed (gray), deferred (purple), pinned (blue)
- Priority: critical (red), high (orange), medium (amber), low (green), minimal (gray)
- Font: Inter (UI), JetBrains Mono (monospace)
- Border: `border-default` (#353845)

## Important Patterns

1. **Schema tolerance:** SQLite reader checks which columns exist via `PRAGMA table_info` before querying. Different beads versions have different schemas (e.g. `story_points` is optional).
2. **Graceful degradation:** Every data path has a fallback chain. Never crashes on missing data.
3. **Security:** CLI calls use `execFile` (not `exec`). Diff `since` param validated against safe regex. No user-writeable mutations to issue data (read-only dashboard).
4. **Cache invalidation:** bv-client has 10s server TTL. React Query has 15s stale time + polling. Repo switch invalidates everything.

## File Structure

```
src/
  app/
    layout.tsx              # Root layout (server component)
    page.tsx                # Dashboard
    globals.css             # Custom scrollbar, card classes, animations
    board/page.tsx          # Kanban board
    insights/page.tsx       # Graph analytics
    diff/page.tsx           # Time travel diff
    settings/page.tsx       # Repo management
    issue/[id]/page.tsx     # Issue detail
    api/
      issues/route.ts       # GET issues (supports __all__)
      issues/[id]/route.ts  # GET single issue
      insights/route.ts     # GET graph metrics
      priority/route.ts     # GET priority recommendations
      diff/route.ts         # GET diff since git ref
      health/route.ts       # GET system health
      repos/route.ts        # GET/POST repo config
      token-usage/route.ts  # GET token usage (supports __all__)
  lib/
    bv-client.ts            # Central data layer (bv CLI wrapper)
    types.ts                # All TypeScript types
    sqlite-reader.ts        # SQLite DB reader
    jsonl-fallback.ts       # JSONL fallback + issuesToPlan
    graph-metrics.ts        # Fallback graph analytics
    repo-config.ts          # Multi-repo config (~/.beads-web.json)
    recipes.ts              # Filter engine + saved views
    token-usage.ts          # Token usage reader
    cache.ts                # TTL cache
  hooks/
    useIssues.ts            # Issues data hook
    useIssueDetail.ts       # Single issue hook
    useInsights.ts          # Graph metrics hook
    usePriority.ts          # Priority recommendations hook
    useDiff.ts              # Diff hook
    useHealth.ts            # Health check hook
    useRepos.ts             # Repo config + mutation hook
    useTokenUsage.ts        # Token usage hooks
    useKeyboardShortcuts.ts # Keyboard navigation
  components/
    providers/              # QueryProvider, ClientShell
    layout/                 # Sidebar, Header
    dashboard/              # SummaryCards, WhatsNext, PriorityAlerts, IssueTable, ActivityFeed, TokenUsageSummary
    board/                  # KanbanBoard, KanbanColumn, IssueDetailPanel
    insights/               # MetricPanel, CyclesPanel, GraphDensityBadge, DependencyGraph
    filters/                # FilterBar, RecipeSelector
    ui/                     # StatusBadge, PriorityIndicator, IssueTypeIcon, SummaryCard, IssueCard, EmptyState, ErrorState, LoadingSkeleton, ErrorBoundary, ShortcutsHelp, SetupWizard
```
