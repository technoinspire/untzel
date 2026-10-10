// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The loop section never leaves a new track silent.
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import { dropEdit, moveLoop, toggleLoopMember } from "./loop-section-edits";
import type { EditResult } from "./text-changes";
import { addTrack, duplicateTrack } from "./track-edits";

const registry = registryWith(["kick", "hat", "bass"]);
const kickManifest = registry.get("kick");

const LOOPED = `tempo 124
kick: kick x... x... x... x...
hat:  hat  ..x. ..x. ..x. ..x.   | mute
bass: bass . c2 . c2           // low end
section groove kick | loop
section drop   kick hat bass
song groove 8, drop 8
`;

function sourceOf(result: EditResult): string {
  if (!result.ok) throw new Error(result.reason);
  expect(analyze(result.source, registry).ok).toBe(true);
  return result.source;
}

const sectionLine = (source: string, name: string): string => source.split("\n").find((line) => line.startsWith(`section ${name}`)) ?? "";

describe("adding with a loop section", () => {
  it("addTrack puts the new name in the loop section in the same edit", () => {
    if (kickManifest === undefined) throw new Error("no kick");
    const source = sourceOf(addTrack(LOOPED, kickManifest));
    expect(sectionLine(source, "groove")).toBe("section groove kick kick2 | loop");
    expect(sectionLine(source, "drop")).toBe("section drop   kick hat bass");
  });

  it("duplicateTrack puts the copy in the loop section too", () => {
    const source = sourceOf(duplicateTrack(LOOPED, "bass"));
    expect(sectionLine(source, "groove")).toBe("section groove kick bass2 | loop");
    expect(source).toContain("bass2: bass . c2 . c2           // low end");
  });

  it("leaves a text without a loop section as before", () => {
    if (kickManifest === undefined) throw new Error("no kick");
    const plain = LOOPED.replace(" | loop", "");
    expect(sectionLine(sourceOf(addTrack(plain, kickManifest)), "groove")).toBe("section groove kick");
  });
});

describe("tapping a block in loop mode", () => {
  it("outside the section: joins it and loses its mute, in one edit", () => {
    const source = sourceOf(toggleLoopMember(LOOPED, "hat"));
    expect(sectionLine(source, "groove")).toBe("section groove kick hat | loop");
    expect(source).toContain("hat:  hat  ..x. ..x. ..x. ..x.\n");
  });

  it("inside with a mute: only the mute goes", () => {
    const joined = LOOPED.replace("section groove kick | loop", "section groove kick hat | loop");
    const source = sourceOf(toggleLoopMember(joined, "hat"));
    expect(sectionLine(source, "groove")).toBe("section groove kick hat | loop");
    expect(source).not.toContain("| mute");
  });

  it("inside without a mute: leaves the section, never emptying it", () => {
    const joined = LOOPED.replace("section groove kick | loop", "section groove kick bass | loop");
    expect(sectionLine(sourceOf(toggleLoopMember(joined, "bass")), "groove")).toBe("section groove kick | loop");
    expect(toggleLoopMember(LOOPED, "kick")).toEqual({ ok: false, reason: "SECTION_WOULD_BE_EMPTY" });
  });

  it("refuses without a loop section or with an unknown track", () => {
    expect(toggleLoopMember(LOOPED.replace(" | loop", ""), "hat")).toEqual({ ok: false, reason: "NO_LOOP_SECTION" });
    expect(toggleLoopMember(LOOPED, "ride")).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
  });
});

describe("moving the loop", () => {
  it("moveLoop takes | loop off one section and puts it on another", () => {
    const source = sourceOf(moveLoop(LOOPED, "drop"));
    expect(sectionLine(source, "groove")).toBe("section groove kick");
    expect(sectionLine(source, "drop")).toBe("section drop   kick hat bass | loop");
    expect(moveLoop(LOOPED, "groove")).toEqual({ ok: true, source: LOOPED, changes: [] });
    expect(moveLoop(LOOPED, "outro")).toEqual({ ok: false, reason: "UNKNOWN_SECTION" });
  });

  it("the Drop unmutes everything and moves the loop to the fullest section", () => {
    const source = sourceOf(dropEdit(LOOPED));
    expect(source).not.toContain("| mute");
    expect(sectionLine(source, "drop")).toBe("section drop   kick hat bass | loop");
    expect(sectionLine(source, "groove")).toBe("section groove kick");
  });

  it("a tie goes to the first declared section", () => {
    const tie = LOOPED.replace("section drop   kick hat bass", "section drop   kick").replace("section groove kick | loop", "section groove kick").replace("song", "section outro kick hat | loop\nsong");
    const source = sourceOf(dropEdit(tie.replace("section drop   kick", "section drop   kick hat")));
    expect(sectionLine(source, "drop")).toBe("section drop   kick hat | loop");
    expect(sectionLine(source, "outro")).toBe("section outro kick hat");
  });
});
