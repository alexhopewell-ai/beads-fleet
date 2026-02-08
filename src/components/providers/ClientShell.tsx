"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ShortcutsHelp } from "@/components/ui/ShortcutsHelp";
import { SetupWizard } from "@/components/ui/SetupWizard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function ClientShell({ children }: { children: ReactNode }) {
  useKeyboardShortcuts();

  return (
    <ErrorBoundary>
      {children}
      <SetupWizard />
      <ShortcutsHelp />
    </ErrorBoundary>
  );
}
