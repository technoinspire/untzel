// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { GeneralParameter, rational, type Program, type Track } from "@untzel/core";
import type { AnalyzeResult, Diagnostic } from "@untzel/language";
import { fakeProgram, fakeSection, fakeTrack } from "@untzel/transport/testing";
import type { PlaybackPosition } from "@untzel/transport";
import { describe, expect, it } from "vitest";
import { Session } from "./session";
import type { SessionView } from "../view/view";
import {
  FakeDiagnosticsLog,
  FakeLoadPort,
  FakeScheduleFeed,
  FakeSoundPort,
} from "../testing";

const SYNTAX: Diagnostic = {
  code: "SYNTAX_ERROR",
  message: "Unexpected character",
  messageKey: "unexpected",
  messageArgs: ["!"],
  from: 6,
  to: 7,
  severity: "error",
};

const LOOP = fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: ["..x."] })]);
const MUTED_HAT = fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: ["..x."], muted: true })]);
/** pad: … | gain sine(4) 0.2..0.8 */
const WOBBLE = fakeProgram([
  fakeTrack("kick"),
  fakeTrack("pad", {
    signals: {
      [GeneralParameter.gain]: {
        kind: "signal",
        signal: { shape: "sine", periodBars: rational(4n, 1n) },
        low: 0.2,
        high: 0.8,
        from: 0,
        to: 1,
        curve: "linear",
      },
    },
  }),
]);
const SONG = fakeProgram([fakeTrack("kick"), fakeTrack("hat")], {
  sections: [fakeSection("intro", ["hat"]), fakeSection("drop", ["kick", "hat"], { tempo: 140 })],
  song: {
    parts: [
      { section: "intro", bars: 8 },
      { section: "drop", bars: 16 },
    ],
    loop: false,
  },
});

/** analyze bound to a table: unknown text is a syntax error. */
function analyzer(table: Record<string, Program | AnalyzeResult>) {
  return (source: string): AnalyzeResult => {
    const entry = table[source];
    if (entry === undefined) return { ok: false, diagnostics: [SYNTAX] };
    return "ok" in entry ? entry : { ok: true, program: entry, warnings: [] };
  };
}

function setup(table: Record<string, Program | AnalyzeResult>) {
  const sound = new FakeSoundPort();
  const load = new FakeLoadPort();
  const log = new FakeDiagnosticsLog();
  const schedule = new FakeScheduleFeed();
  const session = new Session({
    sound,
    load,
    log,
    schedule,
    analyze: analyzer(table),
  });
  return { session, sound, load, log, schedule };
}

function position(bar: number, overrides: Partial<PlaybackPosition> = {}): PlaybackPosition {
  return {
    frame: bar * 1_000,
    bar,
    mode: "loop",
    partIndex: null,
    section: null,
    barInPart: null,
    totalBars: null,
    patternBar: bar,
    loopBar: null,
    loopBars: null, framesPerBar: 96_000,
    ...overrides,
  };
}

describe("applyText", () => {
  it("keeps the previous program when the text becomes invalid", () => {
    const { session, sound } = setup({ valid: LOOP });
    session.applyText("valid");
    session.applyText("valid oops");
    expect(sound.loads()).toEqual([LOOP]);
    expect(session.state()).toMatchObject({ source: "valid oops", program: LOOP });
    expect(session.state().diagnostics).toEqual([SYNTAX]);
    expect(session.view().valid).toBe(false);
  });

  it("logs an internal error with the text and keeps the program", () => {
    const error = new Error("defect");
    const { session, sound, log } = setup({
      valid: LOOP,
      boom: {
        ok: false,
        diagnostics: [{ ...SYNTAX, code: "INTERNAL_ERROR", from: 0, to: 0 }],
        internalError: error,
      },
    });
    session.applyText("valid");
    session.applyText("boom");
    expect(log.errors).toEqual([{ source: "boom", error }]);
    expect(session.state().program).toBe(LOOP);
    expect(sound.loads()).toHaveLength(1);
  });

  it("keeps the warnings of a valid text", () => {
    const warning: Diagnostic = { ...SYNTAX, code: "DUPLICATE_MODIFIER", severity: "warning" };
    const { session } = setup({ valid: { ok: true, program: LOOP, warnings: [warning] } });
    session.applyText("valid");
    expect(session.state().warnings).toEqual([warning]);
  });

  it("says there is nothing to play while the program that plays has no track", () => {
    const nothing: Diagnostic = { ...SYNTAX, code: "NOTHING_TO_PLAY", message: "Nothing to play: add a track.", messageKey: "nothingToPlay", messageArgs: [], from: 0, to: 0, severity: "warning" };
    const { session } = setup({ "": { ok: true, program: fakeProgram([]), warnings: [nothing] }, valid: LOOP });
    expect(session.view().nothingToPlay).toBe(false);
    session.applyText("");
    expect(session.view()).toMatchObject({ nothingToPlay: true, warnings: [nothing] });
    // Invalid text keeps the silent program, and with it the notice.
    session.applyText("oops");
    expect(session.view().nothingToPlay).toBe(true);
    session.applyText("valid");
    expect(session.view()).toMatchObject({ nothingToPlay: false, warnings: [] });
  });
});

describe("playback", () => {
  it("needs a program, and song needs sections", () => {
    const { session } = setup({ loop: LOOP });
    expect(session.play()).toEqual({ ok: false, code: "NO_PROGRAM" });
    session.applyText("loop");
    expect(session.play("song")).toEqual({ ok: false, code: "SONG_UNAVAILABLE" });
    expect(session.setMode("song")).toEqual({ ok: false, code: "SONG_UNAVAILABLE" });
  });

  it("chooses the mode from the text, and switches mode when already playing", () => {
    const { session, sound } = setup({ song: SONG });
    session.applyText("song");
    expect(session.play()).toEqual({ ok: true });
    expect(session.play("loop")).toEqual({ ok: true });
    expect(sound.calls.filter((call) => call.kind !== "load")).toEqual([
      { kind: "play", mode: "song" },
      { kind: "setMode", mode: "loop" },
    ]);
    expect(session.state()).toMatchObject({ playing: true, mode: "loop" });
  });

  it("stops, and an ended song stops playing", () => {
    const { session, sound } = setup({ song: SONG });
    session.applyText("song");
    session.play();
    session.stop();
    expect(sound.calls.at(-1)).toEqual({ kind: "stop" });
    expect(session.state().playing).toBe(false);
    session.play();
    sound.emitEnded();
    expect(session.state().playing).toBe(false);
    expect(session.view().position).toBeNull();
  });

});

describe("solo", () => {
  it("silences the other tracks at once, without touching the text", () => {
    const { session, sound } = setup({ loop: LOOP });
    session.applyText("loop");
    expect(session.solo("hat")).toEqual({ ok: true });
    const soloed = sound.loads().at(-1);
    expect(audibleOf(soloed?.tracks[0])).toEqual({ kind: "constant", value: 0 });
    expect(soloed?.tracks[0]?.parameters[GeneralParameter.gain]).toBe(LOOP.tracks[0]?.parameters[GeneralParameter.gain]);
    expect(soloed?.tracks[1]).toBe(LOOP.tracks[1]);
    expect(session.state().source).toBe("loop");
    expect(session.view().tracks.map((track) => track.soloed)).toEqual([false, true]);

    session.solo(null);
    expect(sound.loads().at(-1)).toBe(LOOP);
    expect(session.solo("nope")).toEqual({ ok: false, code: "UNKNOWN_TRACK" });
  });

  it("follows a new text while held", () => {
    const { session, sound } = setup({ loop: LOOP, muted: MUTED_HAT });
    session.applyText("loop");
    session.solo("kick");
    session.applyText("muted");
    expect(audibleOf(sound.loads().at(-1)?.tracks[1])).toEqual({ kind: "constant", value: 0 });
  });

  it("silences a track whose gain is a signal at once, leaving the gain as written", () => {
    const { session, sound } = setup({ wobble: WOBBLE });
    session.applyText("wobble");
    session.solo("kick");
    const soloed = sound.loads().at(-1);
    if (soloed === undefined) throw new Error("no program loaded");
    expect(soloed.tracks[1]?.parameters[GeneralParameter.gain]).toBe(WOBBLE.tracks[1]?.parameters[GeneralParameter.gain]);
    expect(audibleOf(soloed.tracks[1])).toEqual({ kind: "constant", value: 0 });
  });
});

function audibleOf(track: Track | undefined) {
  return track?.parameters.find((parameter) => parameter.index === GeneralParameter.audible)?.value;
}

describe("undo and redo", () => {
  it("walk the text history and reload each program", () => {
    const { session, sound } = setup({ loop: LOOP, muted: MUTED_HAT });
    expect(session.undo()).toEqual({ ok: false, code: "NOTHING_TO_UNDO" });
    session.applyText("loop");
    session.applyText("loop typo");
    session.applyText("muted");
    expect(session.view().canUndo).toBe(true);

    session.undo();
    expect(session.state().source).toBe("loop typo");
    session.undo();
    expect(session.state().source).toBe("loop");
    expect(sound.loads().at(-1)).toBe(LOOP);
    expect(session.undo()).toEqual({ ok: false, code: "NOTHING_TO_UNDO" });

    session.redo();
    session.redo();
    expect(session.state().source).toBe("muted");
    expect(session.redo()).toEqual({ ok: false, code: "NOTHING_TO_REDO" });

    session.undo();
    session.applyText("loop");
    expect(session.view().canRedo).toBe(false);
  });
});

describe("view", () => {
  it("projects tracks, steps, parameters, sections, song, tempo and key", () => {
    const { session } = setup({ song: SONG });
    session.applyText("song");
    const view = session.view();
    expect(view.tempo).toBe(132);
    expect(view.key).toEqual({ tonic: 0, scale: "minor" });
    expect(view.tracks[0]).toMatchObject({ name: "kick", instrument: "kick", status: "on", inSection: null });
    expect(view.tracks[0]?.bars[0]?.slice(0, 2)).toEqual([
      { kind: "hit", source: { from: 0, to: 1 }, probability: null, repeat: 1 },
      { kind: "rest", source: { from: 1, to: 2 }, probability: null, repeat: 1 },
    ]);
    expect(view.tracks[0]?.parameters[0]).toEqual({
      index: 0,
      name: "gain",
      value: 1,
      signal: null,
      explicit: false,
    });
    expect(view.sections[1]).toEqual({ name: "drop", tracks: ["kick", "hat"], tempo: 140, gain: 1 });
    expect(view.song).toEqual({
      parts: [
        { section: "intro", bars: 8, start: 0 },
        { section: "drop", bars: 16, start: 8 },
      ],
      totalBars: 24,
      loop: false,
      declared: true,
      currentPart: null,
    });
  });

  it("follows the song position: section tempo, membership and current part", () => {
    const { session, sound, load } = setup({ song: SONG });
    session.applyText("song");
    session.play();
    load.reading = { fraction: 0.25, calibrated: true };
    sound.emitPosition(position(9, { mode: "song", partIndex: 1, section: "drop", barInPart: 1, totalBars: 24 }));
    const view = session.view();
    expect(view.tempo).toBe(140);
    expect(view.song?.currentPart).toBe(1);
    expect(view.tracks.map((track) => track.inSection)).toEqual([true, true]);
    expect(view.load).toEqual({ fraction: 0.25, calibrated: true });
    expect(view.position?.bar).toBe(9);
  });

  it("shows a muted change as queued until the next bar", () => {
    const { session, sound } = setup({ loop: LOOP, muted: MUTED_HAT });
    session.applyText("loop");
    session.play("loop");
    sound.emitPosition(position(3));
    session.applyText("muted");
    expect(session.view().tracks[1]?.status).toBe("queued-off");
    sound.emitPosition(position(3));
    expect(session.view().tracks[1]?.status).toBe("queued-off");
    sound.emitPosition(position(4));
    expect(session.view().tracks[1]?.status).toBe("off");
  });

  it("changes are immediate while stopped", () => {
    const { session } = setup({ loop: LOOP, muted: MUTED_HAT });
    session.applyText("loop");
    session.applyText("muted");
    expect(session.view().tracks[1]?.status).toBe("off");
  });

  it("carries the sounding ranges of the latest batch while playing", () => {
    const { session, schedule } = setup({ loop: LOOP });
    session.applyText("loop");
    session.play();
    schedule.emit({
      events: [
        {
          frame: 0,
          durationFrames: 10,
          generation: 1,
          trackIndex: 0,
          value: { kind: "hit", accent: false },
          velocity: 0.8,
          source: { from: 4, to: 5 },
        },
      ],
      parameters: [],
      position: position(0),
    });
    expect(session.view().sounding).toEqual([{ from: 4, to: 5 }]);
    session.stop();
    expect(session.view().sounding).toEqual([]);
  });

  it("notifies subscribers with the new view, and stops after unsubscribe", () => {
    const { session } = setup({ loop: LOOP });
    const views: SessionView[] = [];
    const unsubscribe = session.subscribe((view) => views.push(view));
    session.applyText("loop");
    session.play();
    unsubscribe();
    session.stop();
    expect(views.map((view) => view.playing)).toEqual([false, true]);
  });

  it("returns the same view object until something changes", () => {
    const { session } = setup({ loop: LOOP });
    session.applyText("loop");
    expect(session.view()).toBe(session.view());
  });
});

describe("shareableSource", () => {
  it("is the current text when valid, else the last valid one, and null without a program", () => {
    const { session } = setup({ "tempo 132": LOOP });
    expect(session.shareableSource()).toBeNull();
    session.applyText("broken");
    expect(session.shareableSource()).toBeNull();
    session.applyText("tempo 132");
    expect(session.shareableSource()).toEqual({ source: "tempo 132", isCurrent: true });
    session.applyText("tempo 13");
    expect(session.shareableSource()).toEqual({ source: "tempo 132", isCurrent: false });
  });
});

describe("song view", () => {
  it("is the arrangement the transport plays: declared parts, or 8 bars per section", () => {
    const sectionsOnly = fakeProgram([fakeTrack("kick")], {
      sections: [fakeSection("a", ["kick"]), fakeSection("b", ["kick"])],
    });
    const { session } = setup({ song: SONG, sections: sectionsOnly });
    session.applyText("song");
    expect(session.view().song).toEqual({
      parts: [
        { section: "intro", bars: 8, start: 0 },
        { section: "drop", bars: 16, start: 8 },
      ],
      totalBars: 24,
      loop: false,
      declared: true,
      currentPart: null,
    });
    session.applyText("sections");
    expect(session.view().song).toMatchObject({
      parts: [
        { section: "a", bars: 8, start: 0 },
        { section: "b", bars: 8, start: 8 },
      ],
      totalBars: 16,
      loop: true,
      declared: false,
    });
  });
});
