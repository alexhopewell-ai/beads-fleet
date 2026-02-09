"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { RobotPriority } from "@/lib/types";

export function usePriority() {
  return useQuery<RobotPriority>({
    queryKey: ["priority"],
    queryFn: async () => {
      const res = await fetch("/api/priority");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
