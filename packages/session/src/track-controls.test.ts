// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest, Program } from "@untzel/core";
import type { PlaybackPosition } from "@untzel/transport";
import * as language from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { PatternEdits } from "./edits/pattern-edits";
import type { PatternSourceEditor, StatementSourceEditor } from "./ports";
import { Session } from "./use-cases/session";
import { SongEdits } from "./edits/song-edits";
import { SoundEdits, type SoundEditor } from "./edits/sound-edits";
import { startWithSound } from "./edits/starter-sounds";
import { StatementEdits } from "./edits/statement-edits";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "./testing";
import { TrackEdits } from "./edits/track-edits";
import { TRACK_PREVIEW_BARS, previewProgram } from "./audition/track-preview";
import { soloProgram } from "./edits/solo";

// The use cases of the track controls front:
// each gesture is one undo step with a label, and the music never stops.


const registry = registryWith(["acid", "bass", "hat", "kick", "pad", "ride"]);

function resolved(instrument: string): InstrumentManifest | undefined {
  return registry.get(instrument);
}

/** The composition's bindings (apps/web adapters/source-editor.ts). */
const editor = {
  setTrackMuted: language.setTrackMuted,
  dropEdit: language.dropEdit,
  toggleLoopMember: language.toggleLoopMember,
  setTrackParameter: language.setTrackParameter,
  toggleStep: language.toggleStep,
  setStepPitch: language.setStepPitch,
  setTrackFree: language.setTrackFree,
  addTrack(source: string, instrument: string, sound: string | null, pattern: string | null, key: Parameters<typeof language.addTrack>[4]) {
    const found = resolved(instrument);
    if (found === undefined) return { ok: false as const, reason: "UNKNOWN_INSTRUMENT" as const };
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
const statements: StatementSourceEditor = { setTempo: language.setTempo, setKey: language.setKey };
const patterns: PatternSourceEditor = {
  setTrackPattern(source, track, instrument, pattern, key) {
    const found = resolved(instrument);
    const named = found?.patterns.find((entry) => entry.name === pattern);
    if (found === undefined || named === undefined) return { ok: false, reason: "INVALID_NAME" };
    return language.setTrackPattern(source, track, found, named, key);
  },
};
const sounds: SoundEditor = {
  setSound(source, track, instrument, sound) {
    const found = resolved(instrument);
    return found === undefined ? { ok: false, reason: "UNKNOWN_INSTRUMENT" } : language.setSound(source, track, found, sound);
  },
  addEffect: language.addEffect,
  removeEffect: language.removeEffect,
  setInstrument(source, track, instrument, preset) {
    const found = resolved(instrument);
    return found === undefined ? { ok: false, reason: "UNKNOWN_INSTRUMENT" } : language.setInstrument(source, track, found, preset);
  },
};

const TEXT = `tempo 124
key c minor
kick: kick x... x... x... x...
hat: hat ..x. ..x. ..x. ..x.
ride: hat x.x. x.x. x.x. x.x. | open 0.7
bass: bass . . . c2 . . . . . . . . . . eb2 . | cutoff 900 | drive 0.4
section build kick hat
section drop kick hat ride bass
song build 8, drop 16, build 8, drop 16
`;

function setup(text = TEXT) {
  const sound = new FakeSoundPort();
  const log = new FakeDiagnosticsLog();
  const session = new Session({ sound, load: new FakeLoadPort(), log, analyze: (source) => language.analyze(source, registry) });
  session.applyText(text);
  return {
    session,
    sound,
    edits: new TrackEdits({ session, editor, registry }),
    song: new SongEdits({ session, editor }),
    statements: new StatementEdits(session, statements),
    patterns: new PatternEdits(session, patterns),
    sounds: new SoundEdits(session, sounds),
  };
}

function lastLoaded(sound: FakeSoundPort): Program | undefined {
  return sound.loads().at(-1);
}

function position(bar: number): PlaybackPosition {
  return { frame: bar * 1_000, bar, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar: bar, loopBar: null, loopBars: null, framesPerBar: 1_000 };
}

describe("rename", () => {
  it("renames hat to hats with every section, one undo step that says what it was", () => {
    const { session, edits } = setup();
    expect(edits.renameTrack("hat", "hats")).toEqual({ ok: true });
    expect(session.state().source).toContain("hats: hat ..x.");
    expect(session.view().sections.map((section) => section.tracks.includes("hats"))).toEqual([true, true]);
    expect(session.undo()).toEqual({ ok: true, label: { what: "rename", target: "hats" } });
    expect(session.state().source).toBe(TEXT);
  });

  it("keeps a soloed track soloed under its new name, without a load in between", () => {
    const { session, edits, sound } = setup();
    session.solo("ride");
    const loads = sound.loads().length;
    edits.renameTrack("ride", "top");
    expect(session.view().solo).toBe("top");
    expect(sound.loads().length).toBe(loads + 1);
    expect(lastLoaded(sound)?.tracks.find((track) => track.name === "kick")?.parameters.find((parameter) => parameter.name === "audible")).toBeDefined();
  });

  it("renames the part drop to peak and the song follows; undo brings drop back", () => {
    const { session, song } = setup();
    expect(song.renameSection("drop", "peak")).toEqual({ ok: true });
    expect(session.view().song?.parts.map((part) => part.section)).toEqual(["build", "peak", "build", "peak"]);
    session.undo();
    expect(session.state().source).toBe(TEXT);
    expect(song.renameSection("drop", "build")).toEqual({ ok: false, code: "NAME_TAKEN" });
  });
});

describe("tempo and key", () => {
  it("writes the tempo line; changes from one open editor are one undo step", () => {
    const { session, statements } = setup();
    statements.setTempo(125);
    statements.setTempo(126);
    statements.setTempo(128);
    expect(session.state().source).toContain("tempo 128\n");
    expect(session.view().songTempo).toBe(128);
    session.endGesture();
    statements.setKey("d", "dorian");
    expect(session.state().source).toContain("key d dorian\n");
    expect(session.undo()).toEqual({ ok: true, label: { what: "key", target: null } });
    expect(session.undo()).toEqual({ ok: true, label: { what: "tempo", target: null } });
    expect(session.state().source).toBe(TEXT);
  });

  it("refuses a tempo outside 40 to 300 and keeps playing", () => {
    const { session, statements } = setup();
    session.play("loop");
    expect(statements.setTempo(320)).toEqual({ ok: false, code: "INVALID_VALUE" });
    expect(session.view().playing).toBe(true);
  });
});

describe("Change sound", () => {
  it("swaps the bass for acid and keeps the pattern and the compatible parameters", () => {
    const { session, sounds } = setup();
    const notes = (name: string) =>
      session.view().tracks.find((track) => track.name === name)?.bars.map((bar) => bar.map((step) => (step.kind === "note" ? step.midi : step.kind)));
    const before = notes("bass");
    expect(sounds.setTrackSound("bass", "acid", "squelch")).toEqual({ ok: true });
    const after = session.view().tracks.find((track) => track.name === "bass");
    expect(after?.instrument).toBe("acid");
    expect(notes("bass")).toEqual(before);
    // cutoff and drive are both acid parameters (the VA drive).
    expect(session.state().source).toContain("bass: acid squelch . . . c2 . . . . . . . . . . eb2 . | cutoff 900 | drive 0.4\n");
    expect(session.undo()).toEqual({ ok: true, label: { what: "sound", target: "bass" } });
  });

  it("previews acid on the bass, then Use writes the previewed text in one step", () => {
    const { session, sounds } = setup();
    expect(sounds.previewTrackSound("bass", "acid", "squelch")).toEqual({ ok: true });
    expect(session.state().source).toBe(TEXT);
    expect(session.view().trackPreview).toMatchObject({ track: "bass", label: "acid · squelch" });
    expect(sounds.setTrackSound("bass", "acid", "squelch")).toEqual({ ok: true });
    expect(session.view().trackPreview).toBeNull();
    expect(session.view().tracks.find((track) => track.name === "bass")?.instrument).toBe("acid");
    expect(session.undo()).toEqual({ ok: true, label: { what: "sound", target: "bass" } });
    expect(session.state().source).toBe(TEXT);
  });

  it("refuses a drum for a pattern of notes", () => {
    const { sounds } = setup();
    expect(sounds.setTrackSound("bass", "kick", null)).toEqual({ ok: false, code: "INVALID_VALUE" });
  });
});

describe("Use Tone", () => {
  it("removes open from the ride in one step and undo brings it back", () => {
    const { session, edits } = setup();
    expect(edits.useTone("ride")).toEqual({ ok: true, removed: ["open"] });
    expect(session.state().source).toContain("ride: hat x.x. x.x. x.x. x.x.\n");
    expect(edits.useTone("ride")).toEqual({ ok: true, removed: [] });
    session.undo();
    expect(session.state().source).toBe(TEXT);
  });
});

describe("the gain fader", () => {
  it("writes gain 1 at 75 % of the travel and a drag is one undo step until it ends", () => {
    const { session, edits } = setup();
    expect(edits.setParamFraction("hat", "gain", 0.6)).toEqual({ ok: true, value: 0.501 });
    expect(edits.setParamFraction("hat", "gain", 0.75)).toEqual({ ok: true, value: 1 });
    expect(session.state().source).toContain("hat: hat ..x. ..x. ..x. ..x. | gain 1\n");
    session.endGesture();
    edits.setParamFraction("hat", "gain", 1);
    expect(session.state().source).toContain("| gain 1.995\n");
    expect(session.undo()).toEqual({ ok: true, label: { what: "gain", target: "hat" } });
    expect(session.state().source).toContain("| gain 1\n");
    session.undo();
    expect(session.state().source).toBe(TEXT);
  });
});

describe("patterns", () => {
  it("previews a pattern in the music without changing the text, then Use writes what was heard", () => {
    const { session, sound, patterns } = setup();
    session.play("loop");
    expect(patterns.preview("kick", "Broken")).toEqual({ ok: true });
    expect(session.state().source).toBe(TEXT);
    expect(session.view().trackPreview).toEqual({ track: "kick", label: "Broken", instrument: "kick", preset: null });
    expect(session.view().canUndo).toBe(false);
    const playing = lastLoaded(sound)?.tracks.find((track) => track.name === "kick");
    expect(playing?.pattern.bars[0]?.elements.length).toBeGreaterThan(0);
    expect(session.applyTrackPreview("kick", "Four", {})).toEqual({ ok: false, code: "NOT_PREVIEWING" });
    expect(session.applyTrackPreview("hat", "Broken", {})).toEqual({ ok: false, code: "NOT_PREVIEWING" });
    expect(session.state().source).toBe(TEXT);
    expect(patterns.setTrackPattern("kick", "Broken")).toEqual({ ok: true });
    expect(session.state().source).toContain(`kick: kick ${registry.get("kick")?.patterns[1]?.text}\n`);
    expect(session.view().trackPreview).toBeNull();
    expect(session.undo()).toEqual({ ok: true, label: { what: "pattern", target: "kick" } });
    expect(session.state().source).toBe(TEXT);
  });



  it("ends a preview after 16 bars, when the text changes or the transport stops", () => {
    const { session, sound, patterns, edits } = setup();
    session.play("loop");
    sound.emitPosition(position(3));
    patterns.preview("kick", "Broken");
    sound.emitPosition(position(3 + TRACK_PREVIEW_BARS - 1));
    expect(session.view().trackPreview).not.toBeNull();
    sound.emitPosition(position(3 + TRACK_PREVIEW_BARS));
    expect(session.view().trackPreview).toBeNull();
    patterns.preview("kick", "Broken");
    edits.toggleStep("hat", 0, 0);
    expect(session.view().trackPreview).toBeNull();
    patterns.preview("kick", "Broken");
    session.stop();
    expect(session.view().trackPreview).toBeNull();
  });

  it("plays when stopped, so the chip sounds inside the music", () => {
    const { session, patterns } = setup();
    patterns.preview("hat", "Sixteenths");
    expect(session.view().playing).toBe(true);
  });

  it("writes a pattern chip in the music's key: d dorian moves the bass to d", () => {
    const { session, patterns, statements } = setup();
    statements.setKey("d", "dorian");
    patterns.setTrackPattern("bass", "Offbeat");
    expect(session.state().source).toContain("bass: bass . d2 . d2 . d2 . d2 | cutoff 900");
    session.undo();
    expect(session.state().source).toContain("bass: bass . . . c2");
  });

  it("composes a preview with the solo: the preview first, then the solo over it", () => {
    const { session, patterns, sound } = setup();
    session.solo("kick");
    patterns.preview("kick", "Broken");
    const program = session.state().program;
    if (program === null) throw new Error("no program");
    const loaded = lastLoaded(sound);
    expect(loaded?.tracks.map((track) => track.name)).toEqual(program.tracks.map((track) => track.name));
    expect(previewProgram(program, "nothing", program)).toBe(program);
    expect(soloProgram(program, "kick").tracks).toHaveLength(program.tracks.length);
  });
});

describe("a blank project", () => {
  const BLANK = "tempo 124\nkey a minor\nloop 4\n// add a track: kick: kick punch x... x... x... x...\n";

  it("holds zero tracks without a diagnostic and plays silently", () => {
    const { session } = setup(BLANK);
    expect(session.view().valid).toBe(true);
    expect(session.view().tracks).toEqual([]);
    expect(session.play("loop")).toEqual({ ok: true });
  });

  it("a starter adds the instrument with its first pattern in the project's key and plays", () => {
    const { session, edits } = setup(BLANK);
    expect(startWithSound(session, edits, "bass")).toEqual({ ok: true, name: "bass" });
    expect(session.state().source).toContain("bass: bass a1 . . a1 . . a1 .");
    expect(session.view().playing).toBe(true);
    startWithSound(session, edits, "pad");
    expect(session.state().source).toContain("pad: pad Am7 ~ ~ ~");
  });
});
