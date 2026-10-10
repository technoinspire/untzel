// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentGroup, InstrumentKind, InstrumentManifest } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { inProducerOrder, roleOf } from "./producer-order";

function manifest(name: string, group: InstrumentGroup, kind: InstrumentKind): InstrumentManifest {
  return { name, group, kind } as InstrumentManifest;
}

const LIBRARY = {
  pad: manifest("pad", "pads", "chord"),
  lead: manifest("lead", "leads", "pitched"),
  vox: manifest("vox", "leads", "pitched"),
  riser: manifest("riser", "fx", "pitched"),
  clap: manifest("clap", "drums", "drum"),
  hat: manifest("hat", "drums", "drum"),
  bass: manifest("bass", "bass", "pitched"),
  kick: manifest("kick", "drums", "drum"),
};

describe("roleOf", () => {
  it("reads the role from the manifest group and kind", () => {
    expect(Object.fromEntries(Object.entries(LIBRARY).map(([name, entry]) => [name, roleOf(entry)]))).toEqual({
      pad: "harmony",
      lead: "melody",
      vox: "voice",
      riser: "fx",
      clap: "percussion",
      hat: "percussion",
      bass: "bass",
      kick: "kick",
    });
  });
});

describe("inProducerOrder", () => {
  it("puts kick, bass, percussion, harmony, melody, voice and FX in that order, keeping text order inside a role", () => {
    const ordered = inProducerOrder(Object.values(LIBRARY), (entry) => entry);
    expect(ordered.map((entry) => entry.name)).toEqual(["kick", "bass", "clap", "hat", "pad", "lead", "vox", "riser"]);
  });
});
