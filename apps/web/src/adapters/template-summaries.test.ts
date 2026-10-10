// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { templateSummaries } from "./template-summaries";

const { registry } = buildRegistry();
const file = (id: string, text: string) => ({ id, name: id, order: 1, text });

describe("templateSummaries", () => {
  it("reads the tempo and the key of each template from its program", () => {
    const summaries = templateSummaries(
      [file("house/sunday-piano", "// tempo 999 in a comment does not count\ntempo 125\nkey f major\n"), file("psytrance/full-moon", "tempo 145\nkey f# phrygian\n")],
      (source) => analyze(source, registry),
    );
    expect(summaries).toEqual({
      "house/sunday-piano": { bpm: 125, key: { tonic: 5, scale: "major" } },
      "psytrance/full-moon": { bpm: 145, key: { tonic: 6, scale: "phrygian" } },
    });
  });

  it("leaves out a template that does not analyze", () => {
    expect(templateSummaries([file("broken", "tempo 125\nkick: nope x...\n")], (source) => analyze(source, registry))).toEqual({});
  });
});
