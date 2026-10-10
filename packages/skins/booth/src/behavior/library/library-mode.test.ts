// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentGroup, InstrumentKind } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { ADD_MODE, libraryCategoriesOf, libraryEntries, libraryTexts, rowActionLabel, rowRole, rowUsage, type LibraryMode } from "./library-mode";
import type { LibraryEntryView, PatternContentView } from "@untzel/presentation/view-model";
import { soundChangeSummary } from "../feedback/sound-change-summary";
import { track } from "../../testing/view-fixture";

function entry(instrument: string, kind: InstrumentKind, group: InstrumentGroup, parameters: readonly string[] = [], lowest = 24): LibraryEntryView {
  return {
    instrument,
    model: null,
    group,
    kind,
    inSong: 0,
    description: "",
    sounds: [],
    tags: [],
    patterns: [],
    parameters,
    range: kind === "drum" ? null : { lowest, highest: 84 },
  };
}

const LIBRARY = [
  entry("kick", "drum", "drums"),
  entry("riser", "drum", "fx"),
  entry("bass", "pitched", "bass", ["cutoff", "decay", "drive"]),
  entry("acid", "pitched", "bass", ["cutoff", "resonance", "decay"]),
  entry("pluck", "chord", "plucks", ["decay"], 40),
  entry("pad", "chord", "pads"),
  entry("lead", "pitched", "leads"),
];

function replacing(name: string, instrument: string, content: readonly PatternContentView[]): LibraryMode {
  return { kind: "replace", track: { ...track(name, "pitched"), instrument, preset: "rolling", content } };
}

describe("libraryEntries in replace mode", () => {
  it("shows a bass of notes every instrument that plays notes, chords ones too, and no drum or FX", () => {
    const shown = libraryEntries(replacing("bass", "bass", ["notes"]), LIBRARY).map((item) => item.instrument);
    expect(shown).toEqual(["bass", "acid", "pluck", "pad", "lead"]);
    expect([...libraryCategoriesOf(libraryEntries(replacing("bass", "bass", ["notes"]), LIBRARY))]).not.toContain("drums");
  });

  it("shows a pad with Cm7 only the chord instruments", () => {
    expect(libraryEntries(replacing("pad", "pad", ["chords"]), LIBRARY).map((item) => item.instrument)).toEqual(["pluck", "pad"]);
  });

  it("shows a kick only drums, and a track without pattern everything", () => {
    expect(libraryEntries(replacing("kick", "kick", ["hits"]), LIBRARY).map((item) => item.instrument)).toEqual(["kick", "riser"]);
    expect(libraryEntries(replacing("ride", "hat", []), LIBRARY)).toHaveLength(LIBRARY.length);
    expect(libraryEntries(ADD_MODE, LIBRARY)).toHaveLength(LIBRARY.length);
  });
});

describe("libraryTexts", () => {
  it("words the hint and the search from what the pattern plays", () => {
    expect(libraryTexts(replacing("bass", "bass", ["notes"]))).toEqual({
      title: "Change sound",
      hint: "bass keeps its pattern. These sounds play notes.",
      searchLabel: "Search sounds that play notes",
    });
    expect(libraryTexts(replacing("pad", "pad", ["chords", "notes"])).hint).toBe("pad keeps its pattern. These sounds play chords.");
    expect(libraryTexts(replacing("kick", "kick", ["hits"])).searchLabel).toBe("Search sounds that play hits");
    expect(libraryTexts(replacing("ride", "hat", [])).hint).toBe("ride has no pattern yet. Every sound fits.");
    expect(libraryTexts(ADD_MODE).title).toBe("Add track");
  });
});

describe("rows", () => {
  const mode = replacing("bass", "bass", ["notes"]);
  it("offers Use for another instrument and marks the current one", () => {
    const [, , bass, acid] = LIBRARY;
    if (bass === undefined || acid === undefined) throw new Error("fixture");
    expect(rowRole(mode, acid)).toBe("use");
    expect(rowActionLabel(mode, acid)).toBe("Use acid for bass");
    expect(rowRole(mode, bass)).toBe("current");
    expect(rowActionLabel(mode, bass)).toBe("bass, the sound now");
    expect(rowUsage(mode, bass)).toBe("current · rolling");
    expect(rowRole(ADD_MODE, acid)).toBe("add");
    expect(rowActionLabel(ADD_MODE, acid)).toBe("Add acid");
  });
});

describe("soundChangeSummary", () => {
  const bass = { ...track("bass", "pitched"), writtenParameters: ["cutoff", "drive"], noteSpan: { lowest: 36, highest: 39 } };
  it("keeps the pattern, the shared parameters and the mix, and drops the rest", () => {
    expect(soundChangeSummary(bass, entry("acid", "pitched", "bass", ["cutoff", "resonance", "decay"]))).toBe("Keeps the pattern, cutoff and the mix. Drops drive.");
  });

  it("says when kept notes fall below the new instrument's range", () => {
    expect(soundChangeSummary(bass, entry("pluck", "chord", "plucks", ["decay"], 40))).toBe(
      "Keeps the pattern and the mix. Drops cutoff and drive. Some notes are below pluck's range.",
    );
  });

  it("says nothing of range for drums", () => {
    const kick = { ...track("kick", "drum"), writtenParameters: [], noteSpan: null };
    expect(soundChangeSummary(kick, entry("riser", "drum", "fx"))).toBe("Keeps the pattern and the mix.");
  });
});
