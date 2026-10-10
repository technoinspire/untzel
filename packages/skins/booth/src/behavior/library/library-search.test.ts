// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentGroup } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { addLabel, nothingFoundLabel, playingLabel, previewLabel, showAllLabel, soundsLabel } from "./library-labels";
import { GROUP_PREVIEW_COUNT, LIBRARY_CATEGORIES, MAX_QUERY_LENGTH, libraryGroups, librarySuggestions, matches, normalizeQuery } from "./library-search";
import type { LibraryEntryView } from "@untzel/presentation/view-model";

const entry = (instrument: string, group: InstrumentGroup, sounds: string[], description = `${instrument} sound`, tags: string[] = []): LibraryEntryView => ({
  model: null,
  instrument,
  group,
  kind: group === "drums" ? "drum" : "pitched",
  patterns: [],
  parameters: [],
  range: null,
  inSong: 0,
  description,
  sounds: sounds.map((name) => ({ name, description: name })),
  tags,
});

const LIBRARY: readonly LibraryEntryView[] = [
  entry("kick", "drums", ["punch", "deep"]),
  entry("hat", "drums", ["closed", "open"]),
  entry("clap", "drums", ["tight"]),
  entry("conga", "drums", ["open", "low"], "Hand drum", ["afro", "hand"]),
  entry("piano", "keys", ["grand", "bright", "felt"], "Modelled acoustic piano"),
  entry("pluck", "plucks", ["bright", "nylon"], "Plucked string", ["guitar", "string"]),
];

describe("library search", () => {
  it("offers All first, then every instrument group in order", () => {
    expect(LIBRARY_CATEGORIES).toEqual(["all", "drums", "bass", "keys", "plucks", "pads", "brass", "leads", "voices", "fx"]);
  });
  it("trims, lowers and caps the query", () => {
    expect(normalizeQuery("  PiA ")).toBe("pia");
    expect(normalizeQuery("x".repeat(100))).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("matches by name, sound, description, category and tag, as a plain substring", () => {
    const names = (query: string) => LIBRARY.filter((item) => matches(item, normalizeQuery(query))).map((item) => item.instrument);
    expect(names("pia")).toEqual(["piano"]);
    expect(names("felt")).toEqual(["piano"]);
    expect(names("acoustic")).toEqual(["piano"]);
    expect(names("keys")).toEqual(["piano"]);
    expect(names("guitar")).toEqual(["pluck"]);
    expect(names("bright")).toEqual(["piano", "pluck"]);
    expect(names(".*")).toEqual([]);
  });
  it("finds an instrument by its model name", () => {
    const piano = { ...LIBRARY.find((item) => item.instrument === "piano")!, model: "AURA Grand" };
    expect(matches(piano, normalizeQuery("aura"))).toBe(true);
    expect(matches(piano, normalizeQuery("grand"))).toBe(true);
  });

  it("browsing All shows three per group until Show all; a search or a category shows every match", () => {
    const browsing = libraryGroups(LIBRARY, "", "all", new Set());
    const drums = browsing.find((group) => group.group === "drums");
    expect(drums?.entries).toHaveLength(GROUP_PREVIEW_COUNT);
    expect(drums?.hidden).toBe(1);
    expect(libraryGroups(LIBRARY, "", "all", new Set(["drums"]))[0]?.entries).toHaveLength(4);
    expect(libraryGroups(LIBRARY, "", "drums", new Set()).map((group) => [group.group, group.entries.length])).toEqual([["drums", 4]]);
    expect(libraryGroups(LIBRARY, "o", "all", new Set()).find((group) => group.group === "drums")?.hidden).toBe(0);
    expect(libraryGroups(LIBRARY, "pia", "drums", new Set())).toEqual([]);
  });

  it("suggests close names and sounds first, then tags, at most three", () => {
    expect(librarySuggestions(LIBRARY, "pianno")).toEqual(["piano"]);
    expect(librarySuggestions(LIBRARY, "kik")).toEqual(["kick"]);
    expect(librarySuggestions(LIBRARY, "afro beat")).toEqual(["conga"]);
    expect(librarySuggestions(LIBRARY, "zzzzzz")).toEqual([]);
    expect(librarySuggestions(LIBRARY, "")).toEqual([]);
  });
});

describe("library labels", () => {
  const piano = LIBRARY[4];
  if (piano === undefined) throw new Error("fixture");

  it("describes a row and the audition", () => {
    expect(soundsLabel(1)).toBe("1 sound");
    expect(soundsLabel(piano.sounds.length)).toBe("3 sounds");
    expect(playingLabel("bright", "a minor")).toBe("Playing bright in a minor");
    expect(previewLabel("piano", false)).toBe("Preview piano");
    expect(previewLabel("piano", true)).toBe("Stop preview");
  });

  it("names the sound on Add only when it is not the default", () => {
    expect(addLabel(piano, null)).toBe("Add piano");
    expect(addLabel(piano, "grand")).toBe("Add piano");
    expect(addLabel(piano, "felt")).toBe("Add piano · felt");
    const kick = { ...piano, instrument: "kick", patterns: ["Four on the floor", "Broken"] };
    expect(addLabel(kick, null, "Four on the floor")).toBe("Add kick");
    expect(addLabel(kick, "felt", "Broken")).toBe("Add kick · felt · Broken");
    expect(playingLabel("boom", "c minor", "Broken")).toBe("Playing boom · Broken in c minor");
  });

  it("words Show all and the empty search", () => {
    expect(showAllLabel(12, "drums")).toBe("Show all 12 drums");
    expect(nothingFoundLabel("theremin")).toBe('Nothing called "theremin" yet.');
  });
});
