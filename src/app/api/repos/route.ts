import { NextRequest, NextResponse } from "next/server";
import {
  getRepos,
  addRepo,
  removeRepo,
  setActiveRepo,
} from "@/lib/repo-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const store = await getRepos();
    return NextResponse.json(store);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path, name } = body as {
      action: "add" | "remove" | "set-active";
      path: string;
      name?: string;
    };

    if (!action || !path) {
      return NextResponse.json(
        { error: "Missing action or path" },
        { status: 400 },
      );
    }

    let store;
    switch (action) {
      case "add":
        store = await addRepo(path, name);
        break;
      case "remove":
        store = await removeRepo(path);
        break;
      case "set-active":
        store = await setActiveRepo(path);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    return NextResponse.json(store);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
