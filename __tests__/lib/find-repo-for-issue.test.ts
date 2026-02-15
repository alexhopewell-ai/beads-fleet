// =============================================================================
// Tests for findRepoForIssue() in src/lib/repo-config.ts
// =============================================================================

import path from "path";
import fs from "fs";
import os from "os";
import Database from "better-sqlite3";
import { findRepoForIssue } from "@/lib/repo-config";

// ---------------------------------------------------------------------------
// Test fixtures — temp repos with SQLite DBs
// ---------------------------------------------------------------------------

let tmpDir: string;
let repoA: string;
let repoB: string;
let repoNoDb: string;
let configPath: string;

function createBeadsDb(repoPath: string, issueIds: string[]) {
  const beadsDir = path.join(repoPath, ".beads");
  fs.mkdirSync(beadsDir, { recursive: true });
  const dbPath = path.join(beadsDir, "beads.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority INTEGER NOT NULL DEFAULT 2,
      issue_type TEXT NOT NULL DEFAULT 'task',
      owner TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      close_reason TEXT,
      deleted_at TEXT
    )
  `);
  const stmt = db.prepare(
    `INSERT INTO issues (id, title, status, priority, issue_type, created_at, updated_at)
     VALUES (?, ?, 'open', 2, 'task', datetime('now'), datetime('now'))`,
  );
  for (const id of issueIds) {
    stmt.run(id, `Issue ${id}`);
  }
  db.close();
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "find-repo-test-"));

  repoA = path.join(tmpDir, "repo-a");
  repoB = path.join(tmpDir, "repo-b");
  repoNoDb = path.join(tmpDir, "repo-no-db");

  fs.mkdirSync(repoA, { recursive: true });
  fs.mkdirSync(repoB, { recursive: true });
  fs.mkdirSync(repoNoDb, { recursive: true });

  createBeadsDb(repoA, ["ALPHA-001", "ALPHA-002", "ALPHA-003"]);
  createBeadsDb(repoB, ["BETA-001", "BETA-002"]);
  // repoNoDb intentionally has no .beads/beads.db

  // Write a test config
  configPath = path.join(os.homedir(), ".beads-web.json");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// We need to mock readConfig to return our test repos instead of the real config
jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: jest.fn(),
    },
  };
});

import { promises as fsPromises } from "fs";
const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>;

describe("findRepoForIssue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return a config with our test repos
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        repos: [
          { name: "repo-a", path: repoA },
          { name: "repo-b", path: repoB },
          { name: "repo-no-db", path: repoNoDb },
        ],
        activeRepo: "__all__",
      }),
    );
  });

  it("finds an issue in the first repo", async () => {
    const result = await findRepoForIssue("ALPHA-001");
    expect(result).toBe(repoA);
  });

  it("finds an issue in the second repo", async () => {
    const result = await findRepoForIssue("BETA-002");
    expect(result).toBe(repoB);
  });

  it("returns null when issue is not in any repo", async () => {
    const result = await findRepoForIssue("NONEXISTENT-999");
    expect(result).toBeNull();
  });

  it("skips repos without a beads.db", async () => {
    // repoNoDb has no .beads/beads.db — should be silently skipped
    const result = await findRepoForIssue("BETA-001");
    expect(result).toBe(repoB);
  });

  it("returns null when no repos are configured", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ repos: [] }));
    const result = await findRepoForIssue("ALPHA-001");
    expect(result).toBeNull();
  });
});
