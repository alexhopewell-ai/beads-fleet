import { readFileSync, existsSync } from "fs";
import { join } from "path";

const APP_DIR = join(process.cwd(), "src", "app");

describe("favicon and icon files", () => {
  it("icon.svg exists and is valid SVG", () => {
    const iconPath = join(APP_DIR, "icon.svg");
    expect(existsSync(iconPath)).toBe(true);
    const content = readFileSync(iconPath, "utf-8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
  });

  it("icon.svg contains the three beads", () => {
    const content = readFileSync(join(APP_DIR, "icon.svg"), "utf-8");
    // Green bead
    expect(content).toContain("#22c55e");
    // Amber bead
    expect(content).toContain("#f59e0b");
    // Blue bead
    expect(content).toContain("#3b82f6");
  });

  it("apple-icon.tsx exists", () => {
    expect(existsSync(join(APP_DIR, "apple-icon.tsx"))).toBe(true);
  });

  it("manifest.ts exists and references icon.svg", () => {
    const manifestPath = join(APP_DIR, "manifest.ts");
    expect(existsSync(manifestPath)).toBe(true);
    const content = readFileSync(manifestPath, "utf-8");
    expect(content).toContain("/icon.svg");
  });

  it("opengraph-image.tsx exists", () => {
    expect(existsSync(join(APP_DIR, "opengraph-image.tsx"))).toBe(true);
  });
});
