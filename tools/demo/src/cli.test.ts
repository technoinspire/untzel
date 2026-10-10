// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "./cli";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

async function run(...argv: string[]): Promise<{ readonly code: number; readonly output: string }> {
  let output = "";
  const code = await main(argv, { repo, write: (text) => (output += text) });
  return { code, output };
}

describe("pnpm demo plan", () => {
  it("prints the Midnight Bloom timeline with its demo file and total duration", async () => {
    const { code, output } = await run("plan", "melodic-techno/midnight-bloom");
    expect(code).toBe(0);
    expect(output).toContain("demo plan · melodic-techno/midnight-bloom · Midnight Bloom · demos/midnight-bloom.demo.json");
    expect(output).toContain("round trip: same program as the template");
    expect(output).toContain("layer kick (kick)");
    expect(output).toMatch(/total: \d+:\d\d\.\d \(\d+ bars\)/);
  });

  it("finds the same plan by the demo name and by the template id", async () => {
    expect((await run("plan", "midnight-bloom")).output).toBe((await run("plan", "melodic-techno/midnight-bloom")).output);
  });

  it("fails with exit code 2 for an unknown template", async () => {
    const { code, output } = await run("plan", "no-such-template");
    expect(code).toBe(2);
    expect(output).toContain("no template at");
  });

  it("plans every template to a capture of 1:00 to 3:00 and a Story of 1:00 at most, cut on a layer", async () => {
    const { code, output } = await run("plan", "--all");
    expect(output).toContain("every template plans to a 1:00–3:00 capture and a Story of 1:00 at most");
    expect(output).not.toMatch(/^FAIL/m);
    expect(output).toMatch(/^ok +melodic-techno\/midnight-bloom +\d:\d\d\.\d capture · 6 by hand · Story 0:\d\d\.\d from \w+/m);
    expect(code).toBe(0);
  });
  it("refuses a record without a format or with a demo name that is not a plain name, before any work", async () => {
    expect((await run("record", "midnight-bloom")).code).toBe(2);
    expect((await run("record", "../midnight-bloom", "--format", "video")).code).toBe(2);
    expect((await run("record", "midnight-bloom", "--format", "gif")).output).toContain("--format story|video|4k");
    expect((await run()).output).toContain("usage: pnpm demo plan");
  });
});
