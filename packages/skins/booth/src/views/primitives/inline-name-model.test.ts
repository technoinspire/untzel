// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { commitOf, inlineNameModel, renamedAnnouncement } from "./inline-name-model";

const TRACKS = new Set(["kick", "hat", "bass"]);
const PARTS = new Set(["build", "drop"]);

describe("inlineNameModel", () => {
  it("is a button named by the name it shows, described by what it does, while idle", () => {
    const model = inlineNameModel("track", "hat", null, TRACKS);
    expect(model).toMatchObject({ buttonLabel: null, buttonDescription: "Rename track", fieldLabel: "Track name", error: null });
    expect(inlineNameModel("part", "drop", null, PARTS)).toMatchObject({ buttonLabel: null, buttonDescription: "Rename part" });
    expect(inlineNameModel("part", "breakdown_with_long_tail", null, PARTS).buttonDescription).toBe("Rename part");
  });

  it("shows the rule while the draft is valid, and accepts a free name", () => {
    const model = inlineNameModel("track", "hat", "hats", TRACKS);
    expect(model.error).toBeNull();
    expect(model.rule).toBe("Lowercase letters, numbers, - or _, starting with a letter · up to 24 · Enter renames");
    expect(commitOf(model)).toEqual({ kind: "write", name: "hats" });
  });

  it.each([
    ["track", "kick", "A track named kick already exists. Pick another name."],
    ["part", "build", "A part named build already exists."],
    ["track", "open hat", "Use lowercase letters, numbers, - or _, starting with a letter. No spaces."],
    ["track", "x".repeat(25), "Use lowercase letters, numbers, - or _, starting with a letter. No spaces."],
    ["track", "section", "section is a word of the language. Pick another name."],
    ["track", "", "Type a name, or Cancel to keep hat."],
  ] as const)("a %s named %j says %j and writes nothing", (kind, draft, message) => {
    const model = inlineNameModel(kind, kind === "track" ? "hat" : "drop", draft, kind === "track" ? TRACKS : PARTS);
    expect(model.error).toBe(message);
    expect(commitOf(model).kind).toBe("refuse");
  });

  it("closes without writing when the name did not change", () => {
    expect(commitOf(inlineNameModel("track", "hat", "hat", TRACKS))).toEqual({ kind: "close" });
  });

  it("announces a rename, and why leaving the field kept the old name", () => {
    const written = commitOf(inlineNameModel("track", "hat", "hats", TRACKS));
    expect(renamedAnnouncement(written, "hat")).toBe("Renamed hat to hats.");
    const refused = commitOf(inlineNameModel("part", "drop", "build", PARTS));
    expect(renamedAnnouncement(refused, "drop")).toBe("Name not changed: a part named build already exists.");
  });
});
describe("the song title kind", () => {
  it("is free text: spaces, capitals and accents are a title", () => {
    const model = inlineNameModel("title", "Midnight Coast", "  Ação à   Noite ", new Set());
    expect(model).toMatchObject({ fieldLabel: "Song title", buttonLabel: "Rename Midnight Coast", error: null });
    expect(commitOf(model)).toEqual({ kind: "write", name: "Ação à Noite" });
  });
  it("refuses an empty title and one past 60 code points", () => {
    expect(inlineNameModel("title", "Night", "   ", new Set()).error).toBe("Type a title, or Cancel to keep Night.");
    expect(inlineNameModel("title", "Night", "a".repeat(61), new Set()).error).toBe("A song title can have at most 60 characters.");
    expect(commitOf(inlineNameModel("title", "Night", " Night ", new Set()))).toEqual({ kind: "close" });
  });
});
