"use client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

interface HealthResponse {
  bv_available: boolean;
  project_path: string;
  project_valid: boolean;
}

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
