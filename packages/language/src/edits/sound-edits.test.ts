// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { addEffect, removeEffect, setSound } from "./sound-edits";
import type { EditResult } from "./text-changes";

const registry = registryWith();
const piano = registry.get("piano");
const SOURCE = "tempo 124\nkeys: piano  c3 eb3 g3 .   | gain 0.5  // chords\n";

function lineOf(result: EditResult): string {
  if (!result.ok) throw new Error(result.reason);
  const analyzed = analyze(result.source, registry);
  expect(analyzed.ok && analyzed.warnings).toEqual([]);
  return result.source.split("\n")[1] ?? "";
}

describe("setSound", () => {
  if (piano === undefined) throw new Error("no piano");

  it("writes the sound after the instrument, replaces it, and removes it for the default", () => {
    const bright = lineOf(setSound(SOURCE, "keys", piano, "bright"));
    expect(bright).toBe("keys: piano bright  c3 eb3 g3 .   | gain 0.5  // chords");
    const felt = setSound(`tempo 124\n${bright}\n`, "keys", piano, "felt");
    expect(lineOf(felt)).toBe("keys: piano felt  c3 eb3 g3 .   | gain 0.5  // chords");
    expect(lineOf(setSound(`tempo 124\n${bright}\n`, "keys", piano, piano.defaultPreset))).toBe("keys: piano  c3 eb3 g3 .   | gain 0.5  // chords");
  });

  it("refuses a sound the instrument does not have and an unknown track", () => {
    expect(setSound(SOURCE, "keys", piano, "zebra")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(setSound(SOURCE, "lead", piano, "bright")).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });
});

describe("effects", () => {
  it("adds an effect last in the chain with its starting value, once", () => {
    const chorus = lineOf(addEffect(SOURCE, "keys", "chorus"));
    expect(chorus).toBe("keys: piano  c3 eb3 g3 .   | gain 0.5 | chorus 0.3  // chords");
    expect(lineOf(addEffect(`tempo 124\n${chorus}\n`, "keys", "chorus"))).toBe(chorus);
    expect(lineOf(addEffect(SOURCE, "keys", "eq"))).toContain("| eq-high 2");
  });

  it("removes every modifier of the effect, the eq bands included", () => {
    const source = "tempo 124\nkeys: piano c3 | eq-low -3 | gain 0.5 | eq-mid 2 | eq-mid-freq 800 | lowpass 900\n";
    expect(lineOf(removeEffect(source, "keys", "eq"))).toBe("keys: piano c3 | gain 0.5 | lowpass 900");
    expect(lineOf(removeEffect(source, "keys", "lowpass"))).toBe("keys: piano c3 | eq-low -3 | gain 0.5 | eq-mid 2 | eq-mid-freq 800");
  });
});
