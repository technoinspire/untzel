// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { templateFile } from "./cli";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

describe("pnpm sim <id>", () => {
  it("finds a project by its <style>/<project> id, and a root template by its name", () => {
    const file = templateFile(repo, "house/disco-lights");
    expect(file.endsWith("apps/web/src/templates/house/disco-lights.untzel")).toBe(true);
    expect(existsSync(file)).toBe(true);
    expect(existsSync(templateFile(repo, "blank"))).toBe(true);
  });

  it("refuses an id the library does not have, naming the ones it has", () => {
    expect(() => templateFile(repo, "house/nowhere")).toThrow(/no template house\/nowhere; the templates are .*house\/disco-lights/);
  });

  it("keeps a path as a path", () => {
    expect(templateFile(repo, "tools/sim/fixtures/loop-16.untzel").endsWith("tools/sim/fixtures/loop-16.untzel")).toBe(true);
  });
});
