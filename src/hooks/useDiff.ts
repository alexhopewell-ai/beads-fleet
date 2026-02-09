"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { RobotDiff } from "@/lib/types";

export function useDiff(since: string = "HEAD~10") {
  return useQuery<RobotDiff>({
    queryKey: ["diff", since],
    queryFn: async () => {
      const res = await fetch(`/api/diff?since=${encodeURIComponent(since)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    // Diff data is a snapshot — no automatic polling.
    // Refetches only on window focus or when the ref changes.
    refetchInterval: false,
    placeholderData: keepPreviousData,
  });
}
