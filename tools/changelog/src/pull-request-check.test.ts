// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { missingEntry, touchesProduct } from "./pull-request-check";

describe("touchesProduct", () => {
  it.each([
    ["apps/web/src/main.ts", true],
    ["packages/audio/src/engine.ts", true],
    ["packages/skins/booth/src/views/idle/idle-screen.ts", true],
    ["instruments/piano/samples/v1/pack.json", true],
    ["packages/audio/src/engine.test.ts", false],
    ["apps/web/tests/skins/booth/parallel/share/share-link.browser.ts", false],
    ["CONTRIBUTING.md", false],
    ["apps/docs/content/app.md", false],
    ["tools/sim/src/cli.ts", false],
    [".github/workflows/ci.yml", false],
  ])("%s → %s", (path, expected) => {
    expect(touchesProduct(path)).toBe(expected);
  });
});

describe("missingEntry", () => {
  const app = ["apps/web/src/main.ts"];
  it("asks for an entry when the app changes", () => {
    expect(missingEntry({ changed: app, added: [], skip: false })).toMatch(/adds no file to changelog\/entries/);
  });
  it("is satisfied by a new entry file or the no-changelog label", () => {
    expect(missingEntry({ changed: app, added: ["changelog/entries/play-range.json"], skip: false })).toBeNull();
    expect(missingEntry({ changed: app, added: [], skip: true })).toBeNull();
  });
  it("asks nothing of docs, tests or tooling", () => {
    expect(missingEntry({ changed: ["docs/x.md", "tools/sim/src/a.ts"], added: [], skip: false })).toBeNull();
  });
});
