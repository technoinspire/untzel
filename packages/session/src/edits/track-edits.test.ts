// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import * as language from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { parameterValueAt } from "./parameter-fraction";
import type { ArrangementSourceEditor, SourceEditor } from "../ports";
import { Session } from "../use-cases/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort, FakeSourceEditor } from "../testing";
import { SongEdits } from "./song-edits";
import { TrackEdits } from "./track-edits";

const registry = registryWith(["kick", "hat", "bass"]);

/** The composition's binding of the language edits (apps/web adapters/source-editor.ts). */
const languageEditor: SourceEditor & ArrangementSourceEditor = {
  setTrackMuted: language.setTrackMuted,
  dropEdit: language.dropEdit,
  toggleLoopMember: language.toggleLoopMember,
  setTrackParameter: language.setTrackParameter,
  toggleStep: language.toggleStep,
  setStepPitch: language.setStepPitch,
  setTrackFree: language.setTrackFree,
  addTrack(source, instrument, sound, pattern, key) {
    const found = registry.get(instrument);
    if (found === undefined) return { ok: false, reason: "UNKNOWN_INSTRUMENT" };
    return language.addTrack(source, found, sound, found.patterns.find((entry) => entry.name === pattern) ?? null, key);
  },
  removeTrackParameters: language.removeTrackParameters,
  duplicateTrack: language.duplicateTrack,
  renameTrack: language.renameTrack,
  deleteTrack: language.deleteTrack,
  setSectionMembership: language.setSectionMembership,
  setLoopBars: language.setLoopBars,
  setTrackBars: language.setTrackBars,
  setStepCount: language.setStepCount,
  readBar: language.readBar,
  replaceBar: language.replaceBar,
  clearBar: language.clearBar,
  setPartBars: language.setPartBars,
  movePart: language.movePart,
  duplicatePart: language.duplicatePart,
  declareSong: language.declareSong,
  addSection: language.addSection,
  renameSection: language.renameSection,
};

const TEXT = `tempo 132
key c minor
kick: kick x... x... x... x...
hat: hat ..x. ..x. ..x. ..x.
bass: bass . eb2 . c2 . c2 . .
section drop kick hat bass
`;

function setup(editor: SourceEditor & ArrangementSourceEditor = languageEditor) {
  const sound = new FakeSoundPort();
  const session = new Session({
    sound,
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    analyze: (source) => language.analyze(source, registry),
  });
  session.applyText(TEXT);
  const edits = new TrackEdits({ session, editor, registry });
  const song = new SongEdits({ session, editor });
  return { session, sound, edits, song };
}

function line(session: Session, name: string): string {
  return session.state().source.split("\n").find((entry) => entry.startsWith(`${name}:`)) ?? "";
}

describe("TrackEdits over the language edits", () => {
  it("toggles a track through a text edit that is analyzed and loaded", () => {
    const { session, sound, edits } = setup();
    expect(edits.toggleTrack("hat")).toEqual({ ok: true });
    expect(line(session, "hat")).toBe("hat: hat ..x. ..x. ..x. ..x. | mute");
    expect(sound.loads().at(-1)?.tracks.find((track) => track.name === "hat")?.muted).toBe(true);
    expect(edits.toggleTrack("nope")).toEqual({ ok: false, code: "UNKNOWN_TRACK" });
  });

  it("in loop mode with a loop section, a tap edits the section instead of muting", () => {
    const { session, edits } = setup();
    session.applyText(TEXT.replace("section drop kick hat bass", "section groove kick | loop\nsection drop kick hat bass"));
    expect(session.view().mode).toBeNull();
    expect(edits.toggleTrack("hat")).toEqual({ ok: true });
    expect(session.state().source).toContain("section groove kick hat | loop");
    expect(line(session, "hat")).toBe("hat: hat ..x. ..x. ..x. ..x.");
    expect(edits.drop()).toEqual({ ok: true });
    expect(session.state().source).toContain("section drop kick hat bass | loop");
  });
  it("maps a slider position through the manifest curve, and the mix linearly", () => {
    const { session, edits } = setup();
    const bass = registry.get("bass");
    if (bass === undefined) throw new Error("bass is in the test registry");
    const cutoff = bass.parameters.find((parameter) => parameter.name === "cutoff");
    expect(cutoff?.curve).toBe("exponential");
    expect(edits.setParamFraction("bass", "cutoff", 0)).toEqual({ ok: true, value: cutoff?.min });
    expect(line(session, "bass")).toContain(`| cutoff ${String(cutoff?.min)}`);
    edits.setParamFraction("bass", "cutoff", 1.5);
    expect(line(session, "bass")).toContain(`| cutoff ${String(cutoff?.max)}`);
    edits.setParamFraction("bass", "pan", 0.25);
    expect(line(session, "bass")).toContain("| pan -0.5");
    edits.setParamFraction("kick", "tone", 0.333);
    expect(line(session, "kick")).toContain("| tone 0.33");
    expect(edits.setParamFraction("kick", "cutoff", 0.5)).toEqual({ ok: false, code: "UNKNOWN_PARAMETER" });
    expect(edits.setParamFraction("nope", "gain", 0.5)).toEqual({ ok: false, code: "UNKNOWN_TRACK" });
  });

  it("fills a pitched rest with the bar's first note and a drum rest with x", () => {
    const { session, edits } = setup();
    expect(edits.toggleStep("bass", 0, 0)).toEqual({ ok: true });
    expect(line(session, "bass")).toBe("bass: bass eb2 eb2 . c2 . c2 . .");
    edits.toggleStep("hat", 0, 0);
    expect(line(session, "hat")).toBe("hat: hat x.x. ..x. ..x. ..x.");
    expect(edits.toggleStep("bass", 0, 8)).toEqual({ ok: false, code: "UNKNOWN_STEP" });
  });

  it("uses the tonic in octave 2 when the bar has no note", () => {
    const { session, edits } = setup();
    session.applyText(TEXT.replace("bass: bass . eb2 . c2 . c2 . .", "bass: bass . . . ."));
    edits.toggleStep("bass", 0, 1);
    expect(line(session, "bass")).toBe("bass: bass . c2 . .");
  });

  it("sets any note, a hold or a rest, one edit and one undo step each (note picker)", () => {
    const { session, edits } = setup();
    expect(edits.setStepPitch("bass", 0, 1, { kind: "note", note: "g3" })).toEqual({ ok: true });
    expect(line(session, "bass")).toBe("bass: bass . g3 . c2 . c2 . .");
    edits.setStepPitch("bass", 0, 2, { kind: "hold" });
    edits.setStepPitch("bass", 0, 4, { kind: "note", note: "e2" });
    expect(line(session, "bass")).toBe("bass: bass . g3 ~ c2 e2 c2 . .");
    expect(session.view().valid).toBe(true);
    session.undo();
    session.undo();
    expect(line(session, "bass")).toBe("bass: bass . g3 . c2 . c2 . .");
    expect(edits.setStepPitch("bass", 0, 9, { kind: "rest" })).toEqual({ ok: false, code: "UNKNOWN_STEP" });
    expect(edits.setStepPitch("bass", 0, 1, { kind: "note", note: "g" })).toEqual({ ok: false, code: "INVALID_VALUE" });
  });

  it("Scale lock off writes free on the track, on removes it", () => {
    const { session, edits } = setup();
    expect(edits.setScaleLock("bass", false)).toEqual({ ok: true });
    expect(line(session, "bass")).toBe("bass: bass . eb2 . c2 . c2 . . | free");
    expect(session.view().tracks.find((track) => track.name === "bass")?.free).toBe(true);
    edits.setScaleLock("bass", true);
    expect(session.state().source).toBe(TEXT);
  });

  it("adds, copies and deletes tracks, and reports the new names", () => {
    const { session, edits } = setup();
    expect(edits.addTrack("hat")).toEqual({ ok: true, name: "hat2" });
    expect(edits.duplicateTrack("bass")).toEqual({ ok: true, name: "bass2" });
    expect(edits.addTrack("acid")).toEqual({ ok: false, code: "UNKNOWN_INSTRUMENT" });
    expect(edits.deleteTrack("hat2")).toEqual({ ok: true });
    expect(session.view().tracks.map((track) => track.name)).toEqual(["kick", "hat", "bass", "bass2"]);
    expect(edits.renameTrack("bass2", "kick")).toEqual({ ok: false, code: "NAME_TAKEN" });
  });

  it("changes section membership and drops in loop mode only", () => {
    const { session, edits } = setup();
    expect(edits.setSectionMembership("drop", "hat", false)).toEqual({ ok: true });
    expect(session.view().sections[0]?.tracks).toEqual(["kick", "bass"]);
    edits.toggleTrack("kick");
    expect(edits.drop()).toEqual({ ok: true });
    expect(line(session, "kick")).toBe("kick: kick x... x... x... x...");
    session.play("song");
    expect(edits.drop()).toEqual({ ok: false, code: "NOT_IN_LOOP" });
  });
});

describe("loop and pattern lengths", () => {
  it("writes loop <bars> in one undoable edit; the view reports it", () => {
    const { session, sound, edits } = setup();
    expect(session.view().loop).toEqual({ bars: 4, declared: false });
    expect(edits.setLoopBars(16)).toEqual({ ok: true });
    expect(session.state().source.split("\n").slice(0, 3)).toEqual(["tempo 132", "key c minor", "loop 16"]);
    expect(session.view().loop).toEqual({ bars: 16, declared: true });
    expect(sound.loads().at(-1)?.loopBars).toBe(16);
    edits.setLoopBars(8);
    expect(session.view().loop).toEqual({ bars: 8, declared: true });
    session.undo();
    expect(session.view().loop?.bars).toBe(16);
    expect(edits.setLoopBars(17)).toEqual({ ok: false, code: "INVALID_VALUE" });
  });

  it("gives a track 8 bars copied from the last one, and grows a shorter written loop with it", () => {
    const { session, edits } = setup();
    edits.setLoopBars(4);
    expect(edits.setTrackBars("bass", 8)).toEqual({ ok: true });
    expect(session.view().tracks.find((track) => track.name === "bass")?.bars).toHaveLength(8);
    expect(line(session, "bass")).toBe(`bass: bass ${Array.from({ length: 8 }, () => ". eb2 . c2 . c2 . .").join(" / ")}`);
    expect(session.view().loop).toEqual({ bars: 8, declared: true });
    session.undo();
    expect(session.view().loop).toEqual({ bars: 4, declared: true });
    expect(line(session, "bass")).toBe("bass: bass . eb2 . c2 . c2 . .");
  });

  it("without a written loop, the shown length follows the longest pattern", () => {
    const { session, edits } = setup();
    edits.setTrackBars("kick", 6);
    expect(session.view().loop).toEqual({ bars: 6, declared: false });
    expect(session.state().source).not.toContain("loop");
    expect(edits.setTrackBars("kick", 17)).toEqual({ ok: false, code: "INVALID_VALUE" });
    expect(edits.setTrackBars("nope", 2)).toEqual({ ok: false, code: "UNKNOWN_TRACK" });
  });

  it("edits a step in bar 5 of an 8-bar track", () => {
    const { session, edits } = setup();
    edits.setTrackBars("kick", 8);
    expect(edits.toggleStep("kick", 4, 1)).toEqual({ ok: true });
    const bars = line(session, "kick").replace("kick: kick ", "").split(" / ");
    expect(bars[4]).toBe("xx.. x... x... x...");
    expect(bars.filter((bar) => bar === "x... x... x... x...")).toHaveLength(7);
  });

  it("changes steps per bar: drums take rests, pitched notes keep their length", () => {
    const { session, edits } = setup();
    expect(edits.setStepCount("hat", 8)).toEqual({ ok: true });
    expect(line(session, "hat")).toBe("hat: hat .x.x .x.x");
    expect(edits.setStepCount("bass", 16)).toEqual({ ok: true });
    expect(line(session, "bass")).toBe("bass: bass . . eb2 ~ . . c2 ~ . . c2 ~ . . . .");
    expect(edits.setStepCount("bass", 12)).toEqual({ ok: false, code: "INVALID_VALUE" });
  });
});

describe("bars and arrangement", () => {
  it("copies bar 1 into bar 3 and clears a bar, one undo step each", () => {
    const { session, edits } = setup();
    edits.setTrackBars("kick", 4);
    edits.toggleStep("kick", 0, 1);
    const copied = edits.readBar("kick", 0);
    expect(copied).toBe("xx.. x... x... x...");
    expect(edits.pasteBar("kick", 2, copied ?? "")).toEqual({ ok: true });
    expect(line(session, "kick").split(" / ")).toEqual([
      "kick: kick xx.. x... x... x...",
      "x... x... x... x...",
      "xx.. x... x... x...",
      "x... x... x... x...",
    ]);
    expect(edits.clearBar("bass", 0)).toEqual({ ok: true });
    expect(line(session, "bass")).toBe("bass: bass . . . . . . . .");
    expect(session.view().valid).toBe(true);
    session.undo();
    expect(line(session, "bass")).toBe("bass: bass . eb2 . c2 . c2 . .");
    expect(edits.readBar("clap", 0)).toBeNull();
  });

  it("writes the song sections alone play before the first part edit", () => {
    const { session, song } = setup();
    session.applyText(`${TEXT}section break hat\n`);
    expect(session.view().song?.declared).toBe(false);
    expect(song.setPartBars(1, 16)).toEqual({ ok: true });
    expect(session.state().source.trimEnd().split("\n").at(-1)).toBe("song drop 8, break 16");
    expect(song.movePart(1, -1)).toEqual({ ok: true });
    expect(song.duplicatePart(0)).toEqual({ ok: true });
    expect(session.state().source.trimEnd().split("\n").at(-1)).toBe("song break 16, break 16, drop 8");
    expect(song.movePart(5, 1)).toEqual({ ok: false, code: "UNKNOWN_PART" });
    // One undo step per gesture: back to the text before the duplicate.
    session.undo();
    expect(session.state().source.trimEnd().split("\n").at(-1)).toBe("song break 16, drop 8");
  });

  it("adds a part from the tracks that are on, as long as the loop", () => {
    const { session, edits, song } = setup();
    edits.toggleTrack("hat");
    edits.setLoopBars(4);
    const result = song.addPartFromPlaying();
    expect(result).toEqual({ ok: true, name: "part" });
    const lines = session.state().source.trimEnd().split("\n");
    expect(lines).toContain("section part kick bass");
    expect(lines.at(-1)).toBe("song drop 8, part 4");
    expect(session.view().song?.parts.map((part) => part.section)).toEqual(["drop", "part"]);
  });

  it("refuses a part when nothing is on", () => {
    const { edits, song } = setup();
    for (const track of ["kick", "hat", "bass"]) edits.toggleTrack(track);
    expect(song.addPartFromPlaying()).toEqual({ ok: false, code: "NOTHING_PLAYING" });
  });
});

describe("TrackEdits against a fake editor", () => {
  it("maps each use case to its minimal edit", () => {
    const fake = new FakeSourceEditor();
    const { edits } = setup(fake);
    edits.setTone("kick", 0.6);
    edits.setParam("kick", "drive", 0.3);
    edits.toggleStep("hat", 0, 2);
    edits.addTrack("bass");
    edits.duplicateTrack("hat");
    edits.renameTrack("hat", "ride");
    edits.deleteTrack("kick");
    edits.setSectionMembership("drop", "hat", false);
    edits.drop();
    edits.setLoopBars(12);
    edits.setTrackBars("hat", 3);
    edits.setStepCount("bass", 32);
    edits.setStepCount("kick", 32);
    expect(fake.calls).toEqual([
      { method: "setTrackParameter", args: ["kick", "tone", 0.6] },
      { method: "setTrackParameter", args: ["kick", "drive", 0.3] },
      { method: "toggleStep", args: ["hat", 0, 2] },
      { method: "addTrack", args: ["bass"] },
      { method: "duplicateTrack", args: ["hat"] },
      { method: "renameTrack", args: ["hat", "ride"] },
      { method: "deleteTrack", args: ["kick"] },
      { method: "setSectionMembership", args: ["drop", "hat", false] },
      { method: "dropEdit", args: [] },
      { method: "setLoopBars", args: [12] },
      { method: "setTrackBars", args: ["hat", 3] },
      { method: "setStepCount", args: ["bass", 32, true] },
      { method: "setStepCount", args: ["kick", 32, false] },
    ]);
  });

  it("an edit that yields invalid text keeps the program and is undoable", () => {
    const fake = new FakeSourceEditor();
    const { session, sound, edits } = setup(fake);
    fake.result = { ok: true, source: "kick: kik x..." };
    expect(edits.toggleStep("hat", 0, 2)).toEqual({ ok: true });
    expect(session.state().source).toBe("kick: kik x...");
    expect(session.view().valid).toBe(false);
    expect(sound.loads()).toHaveLength(1);
    session.undo();
    expect(session.state().source).toBe(TEXT);
  });
});

describe("parameterValueAt", () => {
  it("rounds to readable text values and clamps the position", () => {
    const cutoff = registry.get("bass");
    expect(parameterValueAt(cutoff, "gain", Number.NaN)).toBe(0);
    expect(parameterValueAt(cutoff, "pan", 0.728)).toBe(0.46);
    // gain is the fader: 0 dB at 75 %, three decimals.
    expect(parameterValueAt(cutoff, "gain", 0.75)).toBe(1);
    expect(parameterValueAt(cutoff, "gain", 0.6)).toBe(0.501);
    expect(parameterValueAt(cutoff, "reverbSpace", 0.5)).toBeNull();
    const value = parameterValueAt(cutoff, "cutoff", 0.5);
    expect(value !== null && Number.isInteger(value)).toBe(true);
  });
});
