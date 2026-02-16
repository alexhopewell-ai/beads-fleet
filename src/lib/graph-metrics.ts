// =============================================================================
// Beads Fleet — Graph Metrics (Fallback when bv is unavailable)
// =============================================================================
//
// Computes simplified graph-based insights from issue dependency data.
// These are lightweight approximations of the metrics that bv computes
// using its full graph engine (PageRank, HITS, Betweenness, etc.).
//
// When bv is available, its robot protocol provides higher-quality results.
// =============================================================================

import type { BeadsIssue, GraphMetricEntry, CycleInfo, RobotInsights } from "./types";

const TOP_N = 10;

interface DepGraph {
  /** issue_id -> set of issue_ids it depends on */
  dependsOn: Map<string, Set<string>>;
  /** issue_id -> set of issue_ids that depend on it (i.e. it blocks them) */
  blockedBy: Map<string, Set<string>>;
  /** issue_id -> title */
  titles: Map<string, string>;
  /** all live (non-closed) issue IDs in the graph */
  liveIds: Set<string>;
}

function buildGraph(issues: BeadsIssue[]): DepGraph {
  const dependsOn = new Map<string, Set<string>>();
  const blockedBy = new Map<string, Set<string>>();
  const titles = new Map<string, string>();
  const allIds = new Set(issues.map((i) => i.id));
  const liveIds = new Set(
    issues.filter((i) => i.status !== "closed").map((i) => i.id),
  );

  for (const issue of issues) {
    titles.set(issue.id, issue.title);
    if (!issue.dependencies) continue;
    for (const dep of issue.dependencies) {
      if (dep.type === "parent-child") continue;
      if (!allIds.has(dep.depends_on_id)) continue;

      if (!dependsOn.has(dep.issue_id)) dependsOn.set(dep.issue_id, new Set());
      dependsOn.get(dep.issue_id)!.add(dep.depends_on_id);

      if (!blockedBy.has(dep.depends_on_id)) blockedBy.set(dep.depends_on_id, new Set());
      blockedBy.get(dep.depends_on_id)!.add(dep.issue_id);
    }
  }

  return { dependsOn, blockedBy, titles, liveIds };
}

function topEntries(
  scores: Map<string, number>,
  titles: Map<string, string>,
  n: number,
): GraphMetricEntry[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .filter(([, score]) => score > 0)
    .map(([id, score]) => ({
      issue_id: id,
      title: titles.get(id) ?? id,
      score: Math.round(score * 1000) / 1000,
    }));
}

// ---------------------------------------------------------------------------
// Bottlenecks — Betweenness Centrality (simplified)
//
// For each node, count how many shortest paths between other node pairs
// pass through it. We use BFS from every node for an exact calculation
// on the (typically small) issue graph.
// ---------------------------------------------------------------------------

function computeBottlenecks(g: DepGraph): GraphMetricEntry[] {
  const nodes = [...g.liveIds];
  if (nodes.length < 3) return [];

  const betweenness = new Map<string, number>();
  for (const n of nodes) betweenness.set(n, 0);

  // Build undirected adjacency for shortest-path computation
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n, new Set());
  for (const [from, tos] of g.dependsOn) {
    if (!g.liveIds.has(from)) continue;
    for (const to of tos) {
      if (!g.liveIds.has(to)) continue;
      adj.get(from)!.add(to);
      adj.get(to)!.add(from);
    }
  }

  for (const source of nodes) {
    // BFS from source
    const dist = new Map<string, number>();
    const sigma = new Map<string, number>(); // number of shortest paths
    const pred = new Map<string, string[]>();
    const stack: string[] = [];

    dist.set(source, 0);
    sigma.set(source, 1);
    const queue = [source];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      const dv = dist.get(v)!;
      for (const w of adj.get(v) ?? []) {
        if (!dist.has(w)) {
          dist.set(w, dv + 1);
          queue.push(w);
        }
        if (dist.get(w) === dv + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 1));
          if (!pred.has(w)) pred.set(w, []);
          pred.get(w)!.push(v);
        }
      }
    }

    // Back-propagation
    const delta = new Map<string, number>();
    for (const n of nodes) delta.set(n, 0);

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const d =
          ((sigma.get(v) ?? 1) / (sigma.get(w) ?? 1)) *
          (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + d);
      }
      if (w !== source) {
        betweenness.set(w, (betweenness.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  // Normalize
  const n = nodes.length;
  const norm = n > 2 ? (n - 1) * (n - 2) : 1;
  for (const [id, val] of betweenness) {
    betweenness.set(id, val / norm);
  }

  return topEntries(betweenness, g.titles, TOP_N);
}

// ---------------------------------------------------------------------------
// Keystones — issues whose resolution unblocks the most transitive work
// ---------------------------------------------------------------------------

function computeKeystones(g: DepGraph): GraphMetricEntry[] {
  const scores = new Map<string, number>();

  for (const id of g.liveIds) {
    // BFS forward through blockedBy to count transitive unblocks
    const visited = new Set<string>();
    const queue = [id];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const blocked of g.blockedBy.get(current) ?? []) {
        if (!visited.has(blocked) && g.liveIds.has(blocked)) {
          visited.add(blocked);
          queue.push(blocked);
        }
      }
    }

    scores.set(id, visited.size - 1); // exclude self
  }

  return topEntries(scores, g.titles, TOP_N);
}

// ---------------------------------------------------------------------------
// Hubs — issues that depend on many things (high out-degree)
// ---------------------------------------------------------------------------

function computeHubs(g: DepGraph): GraphMetricEntry[] {
  const scores = new Map<string, number>();
  for (const id of g.liveIds) {
    const deps = g.dependsOn.get(id);
    scores.set(id, deps ? deps.size : 0);
  }
  return topEntries(scores, g.titles, TOP_N);
}

// ---------------------------------------------------------------------------
// Authorities — issues depended on by many things (high in-degree)
// ---------------------------------------------------------------------------

function computeAuthorities(g: DepGraph): GraphMetricEntry[] {
  const scores = new Map<string, number>();
  for (const id of g.liveIds) {
    const blocked = g.blockedBy.get(id);
    scores.set(id, blocked ? blocked.size : 0);
  }
  return topEntries(scores, g.titles, TOP_N);
}

// ---------------------------------------------------------------------------
// Influencers — degree centrality (connected to many things)
// ---------------------------------------------------------------------------

function computeInfluencers(g: DepGraph): GraphMetricEntry[] {
  const scores = new Map<string, number>();
  for (const id of g.liveIds) {
    const out = g.dependsOn.get(id)?.size ?? 0;
    const inc = g.blockedBy.get(id)?.size ?? 0;
    scores.set(id, out + inc);
  }
  return topEntries(scores, g.titles, TOP_N);
}

// ---------------------------------------------------------------------------
// Cycle Detection — Tarjan's algorithm for strongly connected components
// ---------------------------------------------------------------------------

function detectCycles(g: DepGraph): CycleInfo[] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const cycles: CycleInfo[] = [];
  let cycleId = 1;

  function strongconnect(v: string) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of g.dependsOn.get(v) ?? []) {
      if (!g.liveIds.has(w)) continue;
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      // Only report SCCs with more than 1 node (actual cycles)
      if (component.length > 1) {
        cycles.push({
          cycle_id: cycleId++,
          issues: component,
          length: component.length,
        });
      }
    }
  }

  for (const id of g.liveIds) {
    if (!indices.has(id)) {
      strongconnect(id);
    }
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Graph Density
// ---------------------------------------------------------------------------

function computeDensity(g: DepGraph): number {
  const n = g.liveIds.size;
  if (n < 2) return 0;
  let edges = 0;
  for (const [from, tos] of g.dependsOn) {
    if (!g.liveIds.has(from)) continue;
    for (const to of tos) {
      if (g.liveIds.has(to)) edges++;
    }
  }
  return edges / (n * (n - 1));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute graph-based insights from raw issue data.
 * Returns a full RobotInsights structure with approximate metrics.
 */
export function computeInsightsFromIssues(
  issues: BeadsIssue[],
  projectPath: string,
): RobotInsights {
  const g = buildGraph(issues);

  return {
    timestamp: new Date().toISOString(),
    project_path: projectPath,
    total_issues: issues.length,
    graph_density: computeDensity(g),
    bottlenecks: computeBottlenecks(g),
    keystones: computeKeystones(g),
    influencers: computeInfluencers(g),
    hubs: computeHubs(g),
    authorities: computeAuthorities(g),
    cycles: detectCycles(g),
  };
}
