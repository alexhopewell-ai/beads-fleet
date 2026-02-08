"use client";

import { useState, useRef, useEffect } from "react";
import type { SavedView } from "@/lib/recipes";

interface RecipeSelectorProps {
  views: SavedView[];
  activeViewId?: string;
  onSelect: (view: SavedView) => void;
}

export function RecipeSelector({
  views,
  activeViewId,
  onSelect,
}: RecipeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeView = views.find((v) => v.id === activeViewId);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const builtInViews = views.filter((v) => v.isBuiltIn);
  const customViews = views.filter((v) => !v.isBuiltIn);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-2 border border-border-default rounded-md text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
      >
        {/* Recipe / bookmark icon */}
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <span className="max-w-[140px] truncate">
          {activeView?.name ?? "All Issues"}
        </span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface-1 border border-border-default rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
          {/* Built-in views */}
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Built-in
            </span>
          </div>
          {builtInViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => {
                onSelect(view);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors ${
                view.id === activeViewId
                  ? "bg-surface-2 border-l-2 border-status-open"
                  : "border-l-2 border-transparent"
              }`}
            >
              <div className="text-sm text-gray-200">{view.name}</div>
              {view.description && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {view.description}
                </div>
              )}
            </button>
          ))}

          {/* Custom views */}
          {customViews.length > 0 && (
            <>
              <div className="border-t border-border-default my-1" />
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Custom
                </span>
              </div>
              {customViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => {
                    onSelect(view);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-surface-2 transition-colors ${
                    view.id === activeViewId
                      ? "bg-surface-2 border-l-2 border-status-open"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <div className="text-sm text-gray-200">{view.name}</div>
                  {view.description && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {view.description}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
