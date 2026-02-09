"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { RobotPlan } from "@/lib/types";

export function useIssues() {
  return useQuery<RobotPlan>({
    queryKey: ["issues"],
    queryFn: async () => {
      const res = await fetch("/api/issues");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}
