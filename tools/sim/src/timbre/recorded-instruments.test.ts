// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createRegistry, type InstrumentManifest } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { simRegistry } from "../registry";
import { RECORDED_INSTRUMENTS, recordedInstruments } from "./recorded-instruments";
/** A real manifest of instruments/ under another name, as a new folder would add it. */
function renamed(from: string, name: string): InstrumentManifest {
  const manifest = simRegistry().registry.get(from);
  if (manifest === undefined) throw new Error(`no ${from}`);
  return { ...manifest, name };
}
describe("the recorded instruments of the timbre gate", () => {
  it("are the 13 the gate judged as recorded before the index", () => {
    expect([...RECORDED_INSTRUMENTS].sort()).toEqual(
      ["bell", "bongo", "clap", "conga", "cowbell", "harp", "hat", "kalimba", "mallet", "piano", "shaker", "strings", "woodblock"],
    );
  });
  it("take a new sample pack from its manifest, and leave out the voices", () => {
    const registry = createRegistry([renamed("piano", "glass"), renamed("choir", "chant")]);
    expect([...recordedInstruments(registry, ["chant", "glass"])]).toEqual(["glass"]);
  });
});
