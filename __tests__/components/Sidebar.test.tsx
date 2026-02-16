// =============================================================================
// Tests for Sidebar collapse/expand functionality
// =============================================================================

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Sidebar } from "@/components/layout/Sidebar";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

// Mock hooks
jest.mock("@/hooks/useHealth", () => ({
  useHealth: () => ({ data: { bv_available: true } }),
}));

jest.mock("@/hooks/useRepos", () => ({
  useRepos: () => ({ data: { repos: [], activeRepo: null } }),
  useRepoMutation: () => ({ mutate: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSidebar() {
  return render(<Sidebar />);
}

function getToggleButton() {
  return screen.getByTitle(/collapse sidebar|expand sidebar/i);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar", () => {
  // -------------------------------------------------------------------------
  // Default state (expanded)
  // -------------------------------------------------------------------------

  it("renders expanded by default with brand text", () => {
    renderSidebar();
    expect(screen.getByText("Beads Fleet")).toBeInTheDocument();
  });

  it("shows navigation labels when expanded", () => {
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Fleet")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("shows the collapse button with correct title", () => {
    renderSidebar();
    expect(screen.getByTitle("Collapse sidebar")).toBeInTheDocument();
  });

  it("shows version text when expanded", () => {
    renderSidebar();
    expect(screen.getByText("Beads Fleet v0.1")).toBeInTheDocument();
  });

  it("shows bv status text when expanded", () => {
    renderSidebar();
    expect(screen.getByText("bv connected")).toBeInTheDocument();
  });

  it("has full width class when expanded", () => {
    const { container } = renderSidebar();
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-64");
    expect(aside?.className).not.toContain("w-16");
  });

  // -------------------------------------------------------------------------
  // Collapsed state
  // -------------------------------------------------------------------------

  it("hides brand text when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.queryByText("Beads Fleet")).not.toBeInTheDocument();
  });

  it("hides navigation labels when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Board")).not.toBeInTheDocument();
    expect(screen.queryByText("Fleet")).not.toBeInTheDocument();
    expect(screen.queryByText("Insights")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("hides version text when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.queryByText("Beads Fleet v0.1")).not.toBeInTheDocument();
  });

  it("hides bv status text when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.queryByText("bv connected")).not.toBeInTheDocument();
  });

  it("switches to narrow width class when collapsed", () => {
    const { container } = renderSidebar();
    fireEvent.click(getToggleButton());
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-16");
    expect(aside?.className).not.toContain("w-64");
  });

  it("changes toggle button title to Expand sidebar when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.getByTitle("Expand sidebar")).toBeInTheDocument();
    expect(screen.queryByTitle("Collapse sidebar")).not.toBeInTheDocument();
  });

  it("still renders navigation icons when collapsed", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    // Nav links should still exist (with icons), just no labels
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(7); // 7 nav items
  });

  it("adds title attributes to nav links when collapsed for tooltips", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    const links = screen.getAllByRole("link");
    const titledLinks = links.filter((l) => l.getAttribute("title"));
    expect(titledLinks.length).toBeGreaterThanOrEqual(7);
    expect(titledLinks.map((l) => l.getAttribute("title"))).toContain("Dashboard");
    expect(titledLinks.map((l) => l.getAttribute("title"))).toContain("Fleet");
  });

  // -------------------------------------------------------------------------
  // Toggle round-trip
  // -------------------------------------------------------------------------

  it("restores expanded state on second click", () => {
    renderSidebar();
    fireEvent.click(getToggleButton());
    expect(screen.queryByText("Beads Fleet")).not.toBeInTheDocument();

    fireEvent.click(getToggleButton());
    expect(screen.getByText("Beads Fleet")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByTitle("Collapse sidebar")).toBeInTheDocument();
  });

  it("restores full width on second click", () => {
    const { container } = renderSidebar();
    fireEvent.click(getToggleButton());
    fireEvent.click(getToggleButton());
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-64");
  });

  // -------------------------------------------------------------------------
  // Logo always visible
  // -------------------------------------------------------------------------

  it("keeps the logo icon visible in both states", () => {
    renderSidebar();
    const logo = screen.getByRole("img", { name: "Beads" });
    expect(logo).toBeInTheDocument();

    fireEvent.click(getToggleButton());
    expect(screen.getByRole("img", { name: "Beads" })).toBeInTheDocument();
  });
});
