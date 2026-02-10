"use client";

import { useTokenUsageSummary } from "@/hooks/useTokenUsage";
import { SummaryCard } from "@/components/ui/SummaryCard";

function CostCard({ cost }: { cost: number }) {
  const formatted =
    "$" +
    cost.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Total Cost
        </span>
        <span className="text-lg">$</span>
      </div>
      <div className="text-3xl font-bold text-white">{formatted}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4 space-y-2">
      <div className="animate-pulse bg-surface-2 rounded h-3 w-20" />
      <div className="animate-pulse bg-surface-2 rounded h-8 w-16" />
    </div>
  );
}

export function TokenUsageSummary() {
  const { data, isLoading, error } = useTokenUsageSummary();

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
          Token Usage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.totals.total_tokens === 0) {
    return null;
  }

  const { totals } = data;

  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
        Token Usage
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Tokens"
          value={totals.total_tokens}
          icon="T"
        />
        <CostCard cost={totals.total_cost_usd} />
        <SummaryCard
          label="Sessions"
          value={totals.session_count}
          icon="S"
        />
        <SummaryCard
          label="Total Turns"
          value={totals.total_turns}
          icon=">"
        />
      </div>
    </div>
  );
}
