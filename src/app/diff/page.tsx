"use client";

import { useState } from "react";
import Link from "next/link";
import { useDiff } from "@/hooks/useDiff";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DiffIssueChange } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS = ["HEAD~1", "HEAD~5", "HEAD~10", "HEAD~20"] as const;

const CHANGE_BADGE: Record<
  DiffIssueChange["change_type"],
  { label: string; classes: string }
> = {
  new: {
    label: "NEW",
    classes: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  closed: {
    label: "CLOSED",
    classes: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  },
  modified: {
    label: "MODIFIED",
    classes: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  reopened: {
    label: "REOPENED",
    classes: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
};

const STAT_CARDS: {
  key: "new_count" | "closed_count" | "modified_count" | "reopened_count";
  label: string;
  color: string;
  bgColor: string;
}[] = [
  {
    key: "new_count",
    label: "New",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    key: "closed_count",
    label: "Closed",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
  },
  {
    key: "modified_count",
    label: "Modified",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    key: "reopened_count",
    label: "Reopened",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
];

// ---------------------------------------------------------------------------
// Field diff helper
// ---------------------------------------------------------------------------

function FieldDiff({
  field,
  previous,
  current,
}: {
  field: string;
  previous: unknown;
  current: unknown;
}) {
  const format = (v: unknown): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="font-mono text-gray-500 shrink-0 min-w-[100px]">
        {field}
      </span>
      <span className="text-red-400 line-through">{format(previous)}</span>
      <span className="text-gray-500">-&gt;</span>
      <span className="text-green-400">{format(current)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change item component
// ---------------------------------------------------------------------------

function ChangeItem({ change }: { change: DiffIssueChange }) {
  const badge = CHANGE_BADGE[change.change_type];
  const hasFieldDetails =
    change.change_type === "modified" &&
    change.changed_fields &&
    change.changed_fields.length > 0;

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.classes}`}
        >
          {badge.label}
        </span>
        <Link
          href={`/issue/${change.issue_id}`}
          className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline shrink-0"
        >
          {change.issue_id}
        </Link>
        <span className="text-sm text-gray-300 truncate">{change.title}</span>
      </div>

      {hasFieldDetails && (
        <div className="ml-[72px] space-y-1 border-l-2 border-surface-3 pl-3">
          {change.changed_fields!.map((field) => {
            const prev = change.previous_values?.[field];
            const next = change.new_values?.[field];
            return (
              <FieldDiff
                key={field}
                field={field}
                previous={prev}
                current={next}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-3 border-t-status-open" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DiffPage() {
  const [selectedRef, setSelectedRef] = useState("HEAD~10");
  const [customRef, setCustomRef] = useState("");

  const { data: diff, isLoading, error, refetch } = useDiff(selectedRef);

  const handlePresetClick = (preset: string) => {
    setSelectedRef(preset);
    setCustomRef("");
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customRef.trim();
    if (trimmed) {
      setSelectedRef(trimmed);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-bold text-white">Time Travel</h1>

      {/* Ref selector */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Compare against git ref
        </h2>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 rounded-md text-sm font-mono font-medium transition-colors ${
                selectedRef === preset
                  ? "bg-status-open/20 text-status-open border border-status-open/40"
                  : "bg-surface-2 text-gray-400 hover:text-gray-200 hover:bg-surface-3 border border-transparent"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={customRef}
            onChange={(e) => setCustomRef(e.target.value)}
            placeholder="Custom ref (e.g. abc1234, main~50, v1.0.0)"
            className="flex-1 px-3 py-1.5 text-sm font-mono rounded-md bg-surface-2 border border-border-default text-gray-200 placeholder-gray-500 focus:outline-none focus:border-status-open/50 focus:ring-1 focus:ring-status-open/30"
          />
          <button
            type="submit"
            disabled={!customRef.trim()}
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-status-open/20 text-status-open hover:bg-status-open/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Compare
          </button>
        </form>

        <p className="text-xs text-gray-500">
          Comparing current state against{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-gray-400">
            {selectedRef}
          </code>
        </p>
      </div>

      {/* Loading */}
      {isLoading && <LoadingSpinner />}

      {/* Error */}
      {error && !isLoading && (
        <ErrorState
          message="Failed to load diff"
          detail={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
        />
      )}

      {/* Results */}
      {diff && !isLoading && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAT_CARDS.map((stat) => (
              <div
                key={stat.key}
                className={`card p-4 ${stat.bgColor} border-transparent`}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                  {stat.label}
                </p>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {diff[stat.key]}
                </p>
              </div>
            ))}
          </div>

          {/* Optional metrics */}
          {(diff.density_delta != null ||
            diff.cycles_resolved != null ||
            diff.cycles_introduced != null) && (
            <div className="flex flex-wrap gap-4">
              {diff.density_delta != null && (
                <div className="card px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                    Density Delta
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      diff.density_delta > 0
                        ? "text-amber-400"
                        : diff.density_delta < 0
                        ? "text-green-400"
                        : "text-gray-400"
                    }`}
                  >
                    {diff.density_delta > 0 ? "+" : ""}
                    {diff.density_delta.toFixed(3)}
                  </p>
                </div>
              )}
              {diff.cycles_resolved != null && diff.cycles_resolved > 0 && (
                <div className="card px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                    Cycles Resolved
                  </p>
                  <p className="text-lg font-bold text-green-400">
                    {diff.cycles_resolved}
                  </p>
                </div>
              )}
              {diff.cycles_introduced != null &&
                diff.cycles_introduced > 0 && (
                  <div className="card px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                      Cycles Introduced
                    </p>
                    <p className="text-lg font-bold text-red-400">
                      {diff.cycles_introduced}
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Changes list */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              Changes ({diff.changes.length})
            </h2>
            {diff.changes.length === 0 ? (
              <EmptyState
                message="No changes found"
                description={`No issue changes detected between ${selectedRef} and the current state.`}
              />
            ) : (
              <div className="space-y-2">
                {diff.changes.map((change) => (
                  <ChangeItem
                    key={`${change.issue_id}-${change.change_type}`}
                    change={change}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
