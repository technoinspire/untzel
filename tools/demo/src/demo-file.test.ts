// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDemoFile } from "./demo-file";

const DEMOS = fileURLToPath(new URL("../../../demos/", import.meta.url));

describe("parseDemoFile", () => {
  it.each(readdirSync(DEMOS).filter((file) => file.endsWith(".demo.json")))("demos/%s is valid", (file) => {
    const result = parseDemoFile(JSON.parse(readFileSync(`${DEMOS}${file}`, "utf8")) as unknown);
    expect(result).toMatchObject({ ok: true });
  });

  it("reads the template, the title and the pacing", () => {
    const result = parseDemoFile({ template: "onboard", title: "Midnight Bloom", pacing: { listenBars: 3, layers: { kick: { listenBars: 4 } } } });
    expect(result).toEqual({
      ok: true,
      demo: { template: "onboard", title: "Midnight Bloom", featured: null, pacing: { listenBars: 3, layers: { kick: { listenBars: 4 } } } },
    });
  });
  it("reads the featured tracks and the burst speed", () => {
    const result = parseDemoFile({ template: "onboard", featured: ["kick", "sub"], pacing: { burstCharsPerSecond: 90 } });
    expect(result).toEqual({ ok: true, demo: { template: "onboard", title: null, featured: ["kick", "sub"], pacing: { burstCharsPerSecond: 90 } } });
  });
  it.each([[[]], [["kick", "kick"]], [["a", "b", "c", "d", "e", "f", "g"]], ["kick"], [[""]]])("refuses featured %j", (featured) => {
    expect(parseDemoFile({ template: "onboard", featured })).toEqual({ ok: false, issues: ["featured must list 1 to 6 distinct track names"] });
  });

  it("defaults to no title and default pacing", () => {
    expect(parseDemoFile({ template: "onboard" })).toEqual({ ok: true, demo: { template: "onboard", title: null, featured: null, pacing: {} } });
  });

  it("names every bad field, so a typo never passes silently", () => {
    const result = parseDemoFile({
      template: "",
      actions: [],
      pacing: { listenBar: 2, outroBars: -1, typingCharsPerSecond: 0, gestureSeconds: { tap: 1 }, layers: { kick: { focus: true } } },
    });
    expect(result).toEqual({
      ok: false,
      issues: [
        "template must name a template",
        "actions is not a demo field",
        "pacing.listenBar is not a pacing field",
        "pacing.outroBars must be a whole number ≥ 0",
        "pacing.typingCharsPerSecond must be a number ≥ 1",
        "pacing.gestureSeconds.tap is not a demo action",
        "pacing.layers.kick.focus is not a layer field",
      ],
    });
  });

  it("rejects anything that is not an object", () => {
    expect(parseDemoFile([])).toEqual({ ok: false, issues: ["a demo file must be a JSON object"] });
  });
});
