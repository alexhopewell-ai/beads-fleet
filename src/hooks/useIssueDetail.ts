"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { PlanIssue, BeadsIssue } from "@/lib/types";

interface IssueDetailResponse {
  plan_issue: PlanIssue;
  raw_issue: BeadsIssue | null;
}

export function useIssueDetail(issueId: string | null) {
  return useQuery<IssueDetailResponse>({
    queryKey: ["issue", issueId],
    queryFn: async () => {
      const res = await fetch(`/api/issues/${encodeURIComponent(issueId!)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!issueId,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}
