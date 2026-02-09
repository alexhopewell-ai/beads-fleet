"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { RobotInsights } from "@/lib/types";

export function useInsights() {
  return useQuery<RobotInsights>({
    queryKey: ["insights"],
    queryFn: async () => {
      const res = await fetch("/api/insights");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
