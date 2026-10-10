// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { licenseHeading, packageRootOf, withPackages, type BundledPackage } from "./worker-licenses";

const MAIN = "# Licenses\nThe app bundles dependencies which contain the following licenses:\n\n## crelt - 1.0.7 (MIT)\n\nMIT text\n";
const MEDIABUNNY: BundledPackage = { name: "mediabunny", version: "1.61.0", identifier: "MPL-2.0", text: "Mozilla Public License Version 2.0" };

describe("packageRootOf", () => {
  it("finds the package folder of a pnpm module, scoped or not", () => {
    expect(packageRootOf("/r/node_modules/.pnpm/mediabunny@1.61.0/node_modules/mediabunny/dist/modules/src/index.js")).toBe(
      "/r/node_modules/.pnpm/mediabunny@1.61.0/node_modules/mediabunny",
    );
    expect(packageRootOf("/r/node_modules/.pnpm/@lezer+lr@1.4.10/node_modules/@lezer/lr/dist/index.js")).toBe("/r/node_modules/.pnpm/@lezer+lr@1.4.10/node_modules/@lezer/lr");
  });

  it("ignores the workspace's own sources and virtual modules", () => {
    expect(packageRootOf("/r/packages/export/src/video/render-video.ts")).toBeNull();
    expect(packageRootOf("\0vite/preload-helper.js")).toBeNull();
  });
});

describe("withPackages", () => {
  it("adds a section in Vite's shape for a package only a worker bundles", () => {
    const text = withPackages(MAIN, [MEDIABUNNY]);
    expect(text.startsWith(MAIN)).toBe(true);
    expect(text).toContain("\n## mediabunny - 1.61.0 (MPL-2.0)\n\nMozilla Public License Version 2.0\n");
  });

  it("leaves a package the main bundle already names alone", () => {
    expect(withPackages(MAIN, [{ name: "crelt", version: "1.0.7", identifier: "MIT", text: "MIT text" }])).toBe(MAIN);
  });

  it("writes the heading without an identifier or text when the package has none", () => {
    const bare: BundledPackage = { name: "bare", version: "0.1.0", identifier: null, text: null };
    expect(licenseHeading(bare)).toBe("## bare - 0.1.0");
    expect(withPackages(MAIN, [bare])).toBe(`${MAIN}\n## bare - 0.1.0\n`);
  });
});
