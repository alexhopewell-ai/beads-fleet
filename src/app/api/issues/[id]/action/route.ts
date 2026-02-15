import { NextRequest, NextResponse } from "next/server";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import { getActiveProjectPath } from "@/lib/repo-config";
import { invalidateCache } from "@/lib/bv-client";

const execFile = promisify(execFileCb);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IssueAction = "start" | "close" | "reopen";

const VALID_ACTIONS = new Set<IssueAction>(["start", "close", "reopen"]);
const ISSUE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const issueId = params.id;

  // Validate issue ID format
  if (!issueId || !ISSUE_ID_PATTERN.test(issueId)) {
    return NextResponse.json(
      { error: `Invalid issue ID: ${issueId}` },
      { status: 400 },
    );
  }

  let body: { action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { action, reason } = body;

  // Validate action
  if (!action || !VALID_ACTIONS.has(action as IssueAction)) {
    return NextResponse.json(
      { error: `Invalid action: ${action}. Must be one of: start, close, reopen` },
      { status: 400 },
    );
  }

  // Build bd CLI args
  let args: string[];
  switch (action as IssueAction) {
    case "start":
      args = ["update", issueId, "--status=in_progress"];
      break;
    case "close":
      args = ["close", issueId];
      if (reason) {
        args.push("--reason", reason);
      }
      break;
    case "reopen":
      args = ["update", issueId, "--status=open"];
      break;
  }

  try {
    const projectPath = await getActiveProjectPath();

    await execFile("bd", args, {
      cwd: projectPath,
      timeout: 15_000,
      env: { ...process.env, NO_COLOR: "1" },
    });

    // Bust server-side cache so subsequent reads reflect the change
    invalidateCache();

    return NextResponse.json({ success: true, action, issueId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to ${action} issue ${issueId}: ${message}` },
      { status: 500 },
    );
  }
}
