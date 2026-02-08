// =============================================================================
// Beads Web — bv CLI Client (Robot Protocol Command Wrapper)
// =============================================================================
//
// Executes `bv --robot-*` commands via child_process.execFile (not exec, for
// security) and parses the JSON output into typed structures.
//
// Fallback: when `bv` is not installed or BEADS_PROJECT_PATH is missing, reads
// .beads/issues.jsonl directly and builds simplified responses.
//
// All results are cached with a 10-second TTL to avoid redundant subprocess
// calls within rapid UI refresh cycles.
// =============================================================================

import { execFile as execFileCb } from "child_process";
import { promisify } from "util";

import { cache } from "./cache";
import {
  readIssuesFromJSONL,
  issuesToPlan,
  emptyInsights,
  emptyPriority,
} from "./jsonl-fallback";
import type {
  RobotDiff,
  RobotInsights,
  RobotPlan,
  RobotPriority,
} from "./types";

const execFile = promisify(execFileCb);

// -----------------------------------------------------------------------------
// Configuration helpers
// -----------------------------------------------------------------------------

function getBvPath(): string {
  return process.env.BV_PATH || "bv";
}

function getProjectPath(): string {
  const p = process.env.BEADS_PROJECT_PATH;
  if (!p) throw new Error("BEADS_PROJECT_PATH environment variable is not set");
  return p;
}

/**
 * Resolve the project path to use. If an override is provided, use it.
 * Otherwise fall back to the env var.
 */
function resolveProjectPath(override?: string): string {
  if (override) return override;
  return getProjectPath();
}

// -----------------------------------------------------------------------------
// Low-level bv execution
// -----------------------------------------------------------------------------

async function execBv(args: string[], projectPath?: string): Promise<string> {
  const { stdout } = await execFile(getBvPath(), args, {
    cwd: resolveProjectPath(projectPath),
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return stdout;
}

function isBvNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

const CACHE_KEY_INSIGHTS = "bv:insights";
const CACHE_KEY_PLAN = "bv:plan";
const CACHE_KEY_PRIORITY = "bv:priority";

/**
 * Fetch graph-based insights from `bv --robot-insights`.
 * Falls back to an empty structure if bv is unavailable.
 */
export async function getInsights(projectPath?: string): Promise<RobotInsights> {
  const resolvedPath = resolveProjectPath(projectPath);
  const cacheKey = `${CACHE_KEY_INSIGHTS}:${resolvedPath}`;
  const cached = cache.get<RobotInsights>(cacheKey);
  if (cached) return cached;

  try {
    const stdout = await execBv(["--robot-insights"], resolvedPath);
    const data = JSON.parse(stdout) as RobotInsights;
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (isBvNotFoundError(error)) {
      const fallback = emptyInsights(resolvedPath);
      cache.set(cacheKey, fallback);
      return fallback;
    }
    const fallback = emptyInsights(resolvedPath);
    cache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Fetch the full plan from `bv --robot-plan`.
 * Falls back to JSONL-based plan if bv is unavailable.
 */
export async function getPlan(projectPath?: string): Promise<RobotPlan> {
  const resolvedPath = resolveProjectPath(projectPath);
  const cacheKey = `${CACHE_KEY_PLAN}:${resolvedPath}`;
  const cached = cache.get<RobotPlan>(cacheKey);
  if (cached) return cached;

  try {
    const stdout = await execBv(["--robot-plan"], resolvedPath);
    const data = JSON.parse(stdout) as RobotPlan;
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (isBvNotFoundError(error)) {
      const issues = await readIssuesFromJSONL(resolvedPath);
      const fallback = issuesToPlan(issues, resolvedPath);
      cache.set(cacheKey, fallback);
      return fallback;
    }
    const issues = await readIssuesFromJSONL(resolvedPath);
    const fallback = issuesToPlan(issues, resolvedPath);
    cache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Fetch priority recommendations from `bv --robot-priority`.
 * Falls back to an empty structure if bv is unavailable.
 */
export async function getPriority(projectPath?: string): Promise<RobotPriority> {
  const resolvedPath = resolveProjectPath(projectPath);
  const cacheKey = `${CACHE_KEY_PRIORITY}:${resolvedPath}`;
  const cached = cache.get<RobotPriority>(cacheKey);
  if (cached) return cached;

  try {
    const stdout = await execBv(["--robot-priority"], resolvedPath);
    const data = JSON.parse(stdout) as RobotPriority;
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (isBvNotFoundError(error)) {
      const fallback = emptyPriority(resolvedPath);
      cache.set(cacheKey, fallback);
      return fallback;
    }
    const fallback = emptyPriority(resolvedPath);
    cache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Fetch diff since a git reference from `bv --robot-diff --diff-since <since>`.
 * No good JSONL fallback exists, so returns an empty changes list on failure.
 */
export async function getDiff(since: string, projectPath?: string): Promise<RobotDiff> {
  const resolvedPath = resolveProjectPath(projectPath);
  const cacheKey = `bv:diff:${since}:${resolvedPath}`;
  const cached = cache.get<RobotDiff>(cacheKey);
  if (cached) return cached;

  try {
    const stdout = await execBv(["--robot-diff", "--diff-since", since], resolvedPath);
    const data = JSON.parse(stdout) as RobotDiff;
    cache.set(cacheKey, data);
    return data;
  } catch {
    const fallback: RobotDiff = {
      timestamp: new Date().toISOString(),
      project_path: resolvedPath,
      since_ref: since,
      new_count: 0,
      closed_count: 0,
      modified_count: 0,
      reopened_count: 0,
      changes: [],
    };
    cache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Check whether the `bv` CLI is reachable by running `bv --version`.
 * Result is not cached since this is typically called once at startup.
 */
export async function checkBvAvailable(): Promise<boolean> {
  try {
    await execFile(getBvPath(), ["--version"], {
      timeout: 5_000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a single issue by ID. Reads from the plan data.
 */
export async function getIssueById(
  issueId: string,
  projectPath?: string,
): Promise<{ plan_issue: import("./types").PlanIssue; raw_issue: import("./types").BeadsIssue | null }> {
  const resolvedPath = resolveProjectPath(projectPath);
  const plan = await getPlan(resolvedPath);
  const planIssue = plan.all_issues.find((i) => i.id === issueId);
  if (!planIssue) throw new Error(`Issue not found: ${issueId}`);

  // Try to get the full raw issue from JSONL for description/comments
  let rawIssue: import("./types").BeadsIssue | null = null;
  try {
    const allRaw = await readIssuesFromJSONL(resolvedPath);
    rawIssue = allRaw.find((i) => i.id === issueId) ?? null;
  } catch {
    // JSONL read failed, that's OK
  }

  return { plan_issue: planIssue, raw_issue: rawIssue };
}

/**
 * Invalidate all cached bv responses. Call this after mutations
 * (e.g. issue creation, status change) to force fresh data.
 */
export function invalidateCache(): void {
  cache.invalidateAll();
}
