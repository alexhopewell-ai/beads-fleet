"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useIssueDetail } from "@/hooks/useIssueDetail";
import { useIssues } from "@/hooks/useIssues";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityIndicator } from "@/components/ui/PriorityIndicator";
import { IssueTypeIcon } from "@/components/ui/IssueTypeIcon";
import { ErrorState } from "@/components/ui/ErrorState";
import type { PlanIssue } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveIssues(ids: string[], allIssues: PlanIssue[]): PlanIssue[] {
  return ids
    .map((id) => allIssues.find((i) => i.id === id))
    .filter((i): i is PlanIssue => i !== undefined);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button placeholder */}
      <div className="h-5 w-16 rounded bg-surface-2" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-surface-2" />
        <div className="h-4 w-20 rounded bg-surface-2" />
        <div className="h-6 w-64 rounded bg-surface-2" />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-surface-2" />
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-3/4 rounded bg-surface-2" />
            <div className="h-4 w-5/6 rounded bg-surface-2" />
          </div>
          <div className="card p-5 space-y-3">
            <div className="h-4 w-32 rounded bg-surface-2" />
            <div className="h-4 w-48 rounded bg-surface-2" />
            <div className="h-4 w-48 rounded bg-surface-2" />
          </div>
        </div>
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 rounded bg-surface-2" />
                <div className="h-5 w-24 rounded bg-surface-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dependency list sub-component
// ---------------------------------------------------------------------------

function DependencyList({
  label,
  resolvedIssues,
  unresolvedIds,
}: {
  label: string;
  resolvedIssues: PlanIssue[];
  unresolvedIds: string[];
}) {
  if (resolvedIssues.length === 0 && unresolvedIds.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
          {label}
        </h3>
        <p className="text-sm text-gray-500">None</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
        {label}
      </h3>
      <ul className="space-y-1.5">
        {resolvedIssues.map((dep) => (
          <li key={dep.id} className="flex items-center gap-2 text-sm">
            <Link
              href={`/issue/${dep.id}`}
              className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline shrink-0"
            >
              {dep.id}
            </Link>
            <span className="text-gray-300 truncate">{dep.title}</span>
            <StatusBadge status={dep.status} size="sm" />
          </li>
        ))}
        {unresolvedIds.map((id) => (
          <li key={id} className="flex items-center gap-2 text-sm">
            <Link
              href={`/issue/${id}`}
              className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              {id}
            </Link>
            <span className="text-gray-500 italic">unknown issue</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = typeof params.id === "string" ? params.id : null;

  const {
    data,
    isLoading: detailLoading,
    error: detailError,
    refetch,
  } = useIssueDetail(issueId);

  const { data: planData } = useIssues();
  const allIssues = planData?.all_issues ?? [];

  // Use plan_issue for graph data (blocked_by, blocks), raw_issue for detail fields
  const planIssue = data?.plan_issue ?? null;
  const rawIssue = data?.raw_issue ?? null;

  // The primary display issue merges both sources
  const issue = planIssue;

  // --- Loading ---
  if (detailLoading) {
    return <DetailSkeleton />;
  }

  // --- Error ---
  if (detailError || !issue) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <ErrorState
          message="Issue not found"
          detail={
            detailError instanceof Error
              ? detailError.message
              : `Could not load issue ${issueId ?? "(unknown)"}`
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // --- Resolve dependencies ---
  const blockedByResolved = resolveIssues(issue.blocked_by, allIssues);
  const blockedByUnresolved = issue.blocked_by.filter(
    (id) => !allIssues.some((i) => i.id === id)
  );
  const unblocksResolved = resolveIssues(issue.blocks, allIssues);
  const unblocksUnresolved = issue.blocks.filter(
    (id) => !allIssues.some((i) => i.id === id)
  );

  // --- Labels ---
  const labels = rawIssue?.labels ?? issue.labels ?? [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <IssueTypeIcon type={issue.issue_type} showLabel />
        <span className="font-mono text-sm text-gray-400">{issue.id}</span>
        <h1 className="text-2xl font-bold text-white">{issue.title}</h1>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- Left column (main content) ---- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <section className="card p-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
              Description
            </h2>
            {rawIssue?.description ? (
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {rawIssue.description}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">No description</p>
            )}
          </section>

          {/* Dependency Tree */}
          <section className="card p-5 space-y-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Dependencies
            </h2>
            <DependencyList
              label="Blocked By"
              resolvedIssues={blockedByResolved}
              unresolvedIds={blockedByUnresolved}
            />
            <DependencyList
              label="Unblocks"
              resolvedIssues={unblocksResolved}
              unresolvedIds={unblocksUnresolved}
            />
          </section>
        </div>

        {/* ---- Right column (sidebar) ---- */}
        <div className="space-y-4">
          <div className="card p-5 space-y-5">
            {/* Status */}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                Status
              </h3>
              <StatusBadge status={issue.status} size="md" />
            </div>

            {/* Priority */}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                Priority
              </h3>
              <PriorityIndicator priority={issue.priority} showLabel />
            </div>

            {/* Owner */}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                Owner
              </h3>
              <p className="text-sm text-gray-300">
                {rawIssue?.owner ?? issue.owner ?? "Unassigned"}
              </p>
            </div>

            {/* Labels */}
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                Labels
              </h3>
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-gray-300"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">None</p>
              )}
            </div>

            {/* Impact Score */}
            {issue.impact_score != null && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                  Impact Score
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{
                        width: `${Math.min(issue.impact_score * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-300">
                    {Math.round(issue.impact_score * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Timestamps */}
            {rawIssue && (
              <>
                <div className="border-t border-border-default pt-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                      Created
                    </h3>
                    <p className="text-sm text-gray-400">
                      {formatTimestamp(rawIssue.created_at)}
                    </p>
                    {rawIssue.created_by && (
                      <p className="text-xs text-gray-500">
                        by {rawIssue.created_by}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                      Updated
                    </h3>
                    <p className="text-sm text-gray-400">
                      {formatTimestamp(rawIssue.updated_at)}
                    </p>
                  </div>
                  {rawIssue.closed_at && (
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-0.5">
                        Closed
                      </h3>
                      <p className="text-sm text-gray-400">
                        {formatTimestamp(rawIssue.closed_at)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Close Reason */}
                {rawIssue.close_reason && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
                      Close Reason
                    </h3>
                    <p className="text-sm text-gray-300">
                      {rawIssue.close_reason}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
