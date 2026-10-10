// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest } from "@untzel/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { setPartBars, setSectionMembership } from "./arrangement-edits";
import { setStepPitch } from "./pitch-edits";
import { printNumber } from "./print";
import type { EditResult, NamedEditResult } from "./text-changes";
import {
  addNamedTrack,
  addTrack,
  deleteTrack,
  duplicateTrack,
  renameTrack,
  setTrackMuted,
  setTrackParameter,
  toggleStep,
  unmuteAllTracks,
} from "./track-edits";

const registry = registryWith(["kick", "hat", "bass"]);

const SONG = `// my song
tempo 132 // fast

kick:  kick  x... x... x... x...   | drive 0.3   // the floor
hat:   hat   ..x. ..x. ..x. ..xx   | swing 0.12
bass:  bass  . c2 . c2 . c2 . eb2  | cutoff 900  // low end

// arrangement
section intro  kick   hat
section drop   kick   hat   bass
song intro 8, drop 16
`;

function manifest(name: string): InstrumentManifest {
  const found = registry.get(name);
  if (found === undefined) throw new Error(`no instrument ${name}`);
  return found;
}

function applied(result: EditResult | NamedEditResult): string {
  if (!result.ok) throw new Error(`edit failed: ${result.reason}`);
  return result.source;
}

function comments(source: string): readonly string[] {
  return source.match(/\/\/.*$/gm) ?? [];
}

function expectValid(source: string): void {
  const result = analyze(source, registry);
  expect(result.ok ? [] : result.diagnostics).toEqual([]);
}

describe("minimal edits keep comments and formatting", () => {
  const edits: readonly (readonly [string, (source: string) => EditResult | NamedEditResult])[] = [
    ["mute", (source) => setTrackMuted(source, "hat", true)],
    ["parameter", (source) => setTrackParameter(source, "kick", "drive", 0.5)],
    ["tone", (source) => setTrackParameter(source, "bass", "tone", 0.25)],
    ["toggle step", (source) => toggleStep(source, "kick", 0, 1)],
    ["add track", (source) => addTrack(source, manifest("hat"))],
    ["duplicate", (source) => duplicateTrack(source, "bass")],
    ["rename", (source) => renameTrack(source, "hat", "hats")],
    ["delete", (source) => deleteTrack(source, "bass")],
    ["section membership", (source) => setSectionMembership(source, "intro", "bass", true)],
    ["part bars", (source) => setPartBars(source, 1, 32)],
  ];

  it.each(edits)("%s", (name, edit) => {
    const next = applied(edit(SONG));
    // Deleting a track removes its own line, comment included.
    const expected = comments(SONG).filter((comment) => name !== "delete" || comment !== "// low end");
    expect(comments(next)).toEqual(
      name === "duplicate" ? [...expected.slice(0, 3), "// low end", ...expected.slice(3)] : expected,
    );
    expect(next.startsWith("// my song\ntempo 132 // fast\n\n")).toBe(true);
    expectValid(next);
  });
});

describe("mute and unmute", () => {
  it("appends | mute and removes it again", () => {
    const muted = applied(setTrackMuted(SONG, "hat", true));
    expect(muted).toContain("hat:   hat   ..x. ..x. ..x. ..xx   | swing 0.12 | mute\n");
    expect(applied(setTrackMuted(muted, "hat", true))).toBe(muted);
    expect(applied(setTrackMuted(muted, "hat", false))).toBe(SONG);
  });

  it("puts | mute before a trailing comment", () => {
    const muted = applied(setTrackMuted(SONG, "kick", true));
    expect(muted).toContain("| drive 0.3 | mute   // the floor\n");
  });

  it("unmutes every track in one edit", () => {
    const source = "kick x... | mute\nhat ..x. | mute | gain 0.5\nbass c2";
    const result = unmuteAllTracks(source);
    expect(applied(result)).toBe("kick x...\nhat ..x. | gain 0.5\nbass c2");
    expect(result.ok && result.changes).toHaveLength(2);
  });

  it("fails on an unknown track", () => {
    expect(setTrackMuted(SONG, "acid", true)).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });
});

describe("parameters", () => {
  it("replaces the value of the last modifier with that name", () => {
    const next = applied(setTrackParameter(SONG, "bass", "cutoff", 1200));
    expect(next).toContain("| cutoff 1200  // low end");
    const repeated = applied(setTrackParameter("kick x | gain 0.2 | gain 0.4", "kick", "gain", 0.9));
    expect(repeated).toBe("kick x | gain 0.2 | gain 0.9");
  });

  it("replaces a signal with a number", () => {
    expect(applied(setTrackParameter("b: bass c2 | cutoff sine(8) 300..1400", "b", "cutoff", 900))).toBe(
      "b: bass c2 | cutoff 900",
    );
  });

  it("appends when absent, including tone", () => {
    expect(applied(setTrackParameter("kick x...", "kick", "tone", 0.3333333))).toBe("kick x... | tone 0.3333");
  });

  it("refuses values the grammar cannot read", () => {
    expect(setTrackParameter(SONG, "kick", "drive", Number.NaN)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("toggle step", () => {
  it("flips a hits character", () => {
    const next = applied(toggleStep(SONG, "kick", 0, 2));
    expect(next).toContain("kick:  kick  x.x. x... x... x...");
    expect(applied(toggleStep(next, "kick", 0, 2))).toBe(SONG);
  });

  it("turns a note into a rest and a rest into a note", () => {
    const rested = applied(toggleStep(SONG, "bass", 0, 1));
    expect(rested).toContain("bass:  bass  . . . c2 . c2 . eb2");
    expect(applied(toggleStep(rested, "bass", 0, 1, "c2"))).toBe(SONG);
  });

  it("fails outside the pattern", () => {
    expect(toggleStep(SONG, "kick", 0, 16)).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
    expect(toggleStep(SONG, "kick", 1, 0)).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
  });
});

describe("set step pitch: a note", () => {
  it("replaces a note or a rest in one change", () => {
    expect(applied(setStepPitch(SONG, "bass", 0, 1, { kind: "note", note: "eb2" }))).toContain("bass:  bass  . eb2 . c2 . c2 . eb2");
    expect(applied(setStepPitch(SONG, "bass", 0, 0, { kind: "note", note: "g1" }))).toContain("bass:  bass  g1 c2 . c2 . c2 . eb2");
  });

  it("splits a hits word around the step so the step count stays", () => {
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 1, { kind: "note", note: "c2" }))).toBe("b: bass x c2 x.");
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 0, { kind: "note", note: "c2" }))).toBe("b: bass c2 .x.");
    expect(applied(setStepPitch("b: bass x.x.", "b", 0, 3, { kind: "note", note: "c2" }))).toBe("b: bass x.x c2");
  });

  it("refuses a word that is not a note, and steps outside the pattern", () => {
    expect(setStepPitch(SONG, "bass", 0, 1, { kind: "note", note: "h2" })).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setStepPitch(SONG, "bass", 0, 8, { kind: "note", note: "c2" })).toEqual({ ok: false, reason: "UNKNOWN_STEP" });
  });
});

describe("add and duplicate", () => {
  it("adds after the last track with the next free name", () => {
    const result = addTrack(SONG, manifest("bass"));
    expect(result.ok && result.name).toBe("bass2");
    expect(applied(result)).toContain("| cutoff 900  // low end\nbass2: bass c2 . . c2 . . c2 .\n");
  });

  it("adds a named track in the columns of the track above it (the composer terminal)", () => {
    const result = addNamedTrack(SONG, manifest("bass"), "acid");
    expect(result.ok && result.name).toBe("acid");
    expect(applied(result)).toContain("| cutoff 900  // low end\nacid:  bass  c2 . . c2 . . c2 .\n");
    expect(addNamedTrack(SONG, manifest("bass"), "kick")).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(addNamedTrack(SONG, manifest("bass"), "section")).toEqual({ ok: false, reason: "RESERVED_NAME" });
  });

  it("adds with a chosen name in one line, refusing an invalid or taken one", () => {
    expect(applied(addNamedTrack("kick x...", manifest("hat"), "shaker"))).toBe("kick x...\nshaker: hat ..x. ..x. ..x. ..x.");
    expect(addNamedTrack(SONG, manifest("hat"), "kick")).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(addNamedTrack(SONG, manifest("hat"), "Shaker")).toEqual({ ok: false, reason: "INVALID_NAME" });
  });

  it("adds to an empty text", () => {
    expect(applied(addTrack("", manifest("kick")))).toBe("kick: kick x... x... x... x...");
    expect(applied(addTrack("tempo 120\n", manifest("kick")))).toBe(
      "tempo 120\nkick: kick x... x... x... x...\n",
    );
  });

  it("duplicates with the next free name, keeping the comment", () => {
    const result = duplicateTrack(SONG, "bass");
    expect(result.ok && result.name).toBe("bass2");
    expect(applied(result)).toContain(
      "// low end\nbass2:  bass  . c2 . c2 . c2 . eb2  | cutoff 900  // low end\n",
    );
    expect(duplicateTrack("hat x\nhat2: hat x.", "hat2").ok && "hat3").toBe("hat3");
  });

  it("duplicates an unnamed track", () => {
    expect(applied(duplicateTrack("hat ..x.", "hat"))).toBe("hat ..x.\nhat2: hat ..x.");
  });
});

describe("rename", () => {
  it("updates the track and every section in one edit", () => {
    const result = renameTrack(SONG, "hat", "hats");
    const next = applied(result);
    expect(next).toContain("hats:   hat   ..x.");
    expect(next).toContain("section intro  kick   hats\n");
    expect(next).toContain("section drop   kick   hats   bass\n");
    expect(result.ok && result.changes).toHaveLength(3);
  });

  it("names an unnamed track and keeps automatic names stable", () => {
    const source = "hat x\nhat ..x.\nsection a hat hat2";
    const next = applied(renameTrack(source, "hat", "open"));
    expect(next).toBe("open: hat x\nhat2: hat ..x.\nsection a open hat2");
    expectValid(next);
  });

  it("refuses a taken or invalid name", () => {
    expect(renameTrack(SONG, "hat", "kick")).toEqual({ ok: false, reason: "NAME_TAKEN" });
    expect(renameTrack(SONG, "hat", "Hat")).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(renameTrack(SONG, "hat", "a".repeat(25))).toEqual({ ok: false, reason: "INVALID_NAME" });
  });
});

describe("delete", () => {
  it("removes the line and the name from every section", () => {
    const next = applied(deleteTrack(SONG, "hat"));
    expect(next).not.toContain("..x.");
    expect(next).toContain("section intro  kick\n");
    expect(next).toContain("section drop   kick   bass\n");
  });

  it("removes the last line of a text without a final break", () => {
    expect(applied(deleteTrack("kick x\nhat x", "hat"))).toBe("kick x");
    expect(applied(deleteTrack("kick x\r\nhat x\r\n", "kick"))).toBe("hat x\r\n");
  });

  it("refuses to leave a section without tracks", () => {
    expect(deleteTrack("kick x\nsection a kick", "kick")).toEqual({ ok: false, reason: "SECTION_WOULD_BE_EMPTY" });
  });

  it("keeps automatic names that would shift", () => {
    const next = applied(deleteTrack("hat x\nhat ..x.\nsection a hat2", "hat"));
    expect(next).toBe("hat2: hat ..x.\nsection a hat2");
  });
});

describe("arrangement", () => {
  it("adds and removes a section member", () => {
    const added = applied(setSectionMembership(SONG, "intro", "bass", true));
    expect(added).toContain("section intro  kick   hat bass\n");
    expect(applied(setSectionMembership(added, "intro", "bass", false))).toBe(SONG);
    expect(setSectionMembership(SONG, "outro", "bass", true)).toEqual({ ok: false, reason: "UNKNOWN_SECTION" });
    expect(setSectionMembership(SONG, "intro", "acid", true)).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });

  it("changes the bars of a part", () => {
    expect(applied(setPartBars(SONG, 1, 32))).toContain("song intro 8, drop 32\n");
    expect(setPartBars(SONG, 2, 8)).toEqual({ ok: false, reason: "UNKNOWN_PART" });
    expect(setPartBars(SONG, 0, 0)).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("printNumber", () => {
  it("prints what the grammar reads", () => {
    expect([0.5, -0.3, 1200, 0.33333, 0, -0, 1e-7].map(printNumber)).toEqual(["0.5", "-0.3", "1200", "0.3333", "0", "0", "0"]);
    expect(printNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (value) => {
        const printed = printNumber(value) as string;
        expect(printNumber(Number(printed))).toBe(printed);
        expect(printed).toMatch(/^-?\d+(\.\d+)?$/);
      }),
    );
  });

  it("an edit applied twice gives the same text", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (value) => {
        const once = applied(setTrackParameter(SONG, "kick", "drive", value));
        expect(applied(setTrackParameter(once, "kick", "drive", value))).toBe(once);
        expectValid(once);
      }),
      { numRuns: 50 },
    );
  });
});
