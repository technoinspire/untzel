// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { analyze } from "@untzel/language";
import { Audition, HIT_AUDITION_MIDI, Session } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakePreviewPort, FakeSoundPort } from "@untzel/session/testing";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { announcements } from "../strings/en";
import { DeviceProbeStore } from "./controls/export/device-probe-store";
import { GESTURE_COALESCE_MS } from "./controls/gesture-coalescer";
import { createSessionControls } from "./session-controls-port";
import { languageSoundEditor, languageSourceEditor } from "./source-editor";
import { PreviewNoteAudition } from "./note-audition";

// The phase 1 cases read the phase 1 onboard, kept as a fixture.
const onboard = readFileSync(new URL("../../../../tools/sim/fixtures/phase1-onboard.untzel", import.meta.url), "utf8");
const { registry } = buildRegistry();

function setup() {
  const sound = new FakeSoundPort();
  const session = new Session({
    sound,
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    analyze: (text) => analyze(text, registry),
  });
  session.applyText(onboard);
  const resumeAudio = vi.fn();
  const preview = new FakePreviewPort();
  const libraryAudition = new Audition({ session, port: preview, registry, analyze: (text) => analyze(text, registry), log: new FakeDiagnosticsLog() });
  const audition = new PreviewNoteAudition(libraryAudition);
  const controls = createSessionControls({
    session,
    sound,
    audition,
    libraryAudition,
    editor: languageSourceEditor(registry),
    soundEditor: languageSoundEditor(registry),
    registry,
    log: new FakeDiagnosticsLog(),
    templates: { blank: null, styles: [], projects: [] },
    selectedTemplate: "phase1-onboard",
    nowFrame: () => null,
    sampleRate: 48_000,
    resumeAudio,
    share: {
      store: { link: () => Promise.resolve({ kind: "too-long", length: 0 }), saveLocal: () => true, loadLocal: () => null },
      analyze: (text) => analyze(text, registry),
      autosave: () => ({ rebase: () => undefined, flush: () => undefined, dispose: () => undefined }),
      retitle: (source: string) => source,
      now: () => new Date(2026, 9, 3),
      navigator: { platform: "MacIntel" } as Navigator,
    },
    exporter: {
      // The sheet's state is what these tests read; the export package never loads here.
      load: () => new Promise(() => undefined),
      module: () => new Promise(() => undefined),
      instrumentHashes: [],
      samplePacks: () => Promise.resolve([]),
      workerUrl: "export.worker.js",
      logoUrl: "logo.png",
      fonts: { load: () => Promise.resolve([]), check: () => true },
      reducedMotion: () => false,
      sceneStill: () => Promise.resolve(null),
      internalError: () => undefined,
      now: () => new Date(2026, 9, 3),
      performanceNow: () => 0,
      untitled: () => "Untitled",
      probes: new DeviceProbeStore(null, {
        userAgent: "test",
        cores: 1,
        memoryGb: null,
        screenWidth: 1,
        screenHeight: 1,
        pixelRatio: 1,
      }),
    },
  });
  const said: string[] = [];
  controls.view.onAnnouncement((message) => said.push(message));
  return { session, sound, controls, said, resumeAudio, audition, preview };
}

function line(session: Session, name: string): string {
  return session.state().source.split("\n").find((entry) => entry.startsWith(`${name}:`)) ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("controls over the real session", () => {
  it("plays inside the gesture and stops", () => {
    const { session, sound, controls, said, resumeAudio } = setup();
    controls.playback.togglePlay();
    expect(resumeAudio).toHaveBeenCalledOnce();
    expect(sound.calls.some((call) => call.kind === "play" && call.mode === "loop")).toBe(true);
    controls.playback.togglePlay();
    expect(session.view().playing).toBe(false);
    expect(said).toEqual([announcements.playing, announcements.stopped]);
  });

  it("toggles a track with one edit, an announcement and a line notice", () => {
    const { session, controls, said } = setup();
    const notices: string[] = [];
    controls.feedback.onInterfaceChange((change) => notices.push(change.message));
    controls.tracks.toggleTrack("ride");
    expect(line(session, "ride")).toMatch(/\| mute$/);
    expect(said).toEqual([announcements.trackOnNextBar("ride", false)]);
    expect(notices).toEqual([announcements.lineChanged(7, "ride", "mute", "on")]);
    controls.tracks.setMute("ride", true);
    expect(session.view().canUndo).toBe(true);
    session.undo();
    expect(session.state().source).toBe(onboard);
  });

  it("solos while held without touching the text", () => {
    const { session, controls } = setup();
    controls.tracks.setSolo("hat", true);
    expect(session.view().solo).toBe("hat");
    controls.tracks.setSolo("hat", false);
    expect(session.view().solo).toBeNull();
    expect(session.state().source).toBe(onboard);
  });

  it("coalesces a tone drag into one edit per pause", () => {
    const { session, controls } = setup();
    for (const tone of [0.1, 0.2, 0.3, 0.42]) controls.tracks.setTone("kick", tone);
    expect(session.state().source).toBe(onboard);
    vi.advanceTimersByTime(GESTURE_COALESCE_MS);
    expect(line(session, "kick")).toContain("| tone 0.42");
    session.undo();
    expect(session.state().source).toBe(onboard);
  });

  it("maps a slider through the manifest curve in the session", () => {
    const { session, controls } = setup();
    controls.tracks.setParameter("sub", "cutoff", 1);
    vi.advanceTimersByTime(GESTURE_COALESCE_MS);
    expect(line(session, "sub")).toContain("| cutoff 8000");
  });

  it("sets a note in another octave with one edit and one undo step (note picker)", () => {
    const { session, controls } = setup();
    controls.tracks.setStepPitch("bass", 0, 1, { kind: "note", note: "g3" });
    expect(line(session, "bass")).toContain("bass  . g3 . c2 . c2 . eb2");
    session.undo();
    expect(session.state().source).toBe(onboard);
  });

  it("writes free with Scale lock off, and an audition never changes the text", () => {
    const { session, controls, audition, preview } = setup();
    controls.tracks.setScaleLock("bass", false);
    expect(line(session, "bass")).toContain("| free");
    const text = session.state().source;
    controls.audition.audition("bass", { kind: "note", note: "e3" });
    controls.audition.audition("bass", { kind: "note", note: "e3" });
    controls.audition.audition("bass", { kind: "note", note: "f3" });
    controls.audition.audition("kick", { kind: "hit" });
    controls.audition.audition("clap", { kind: "hit" });
    expect(session.state().source).toBe(text);
    // One voice per track: the same note again at once is the same touch; no track, no sound.
    expect(audition.events()).toEqual([
      { track: "bass", sound: { kind: "note", note: "e3" }, durationMs: 400 },
      { track: "bass", sound: { kind: "note", note: "f3" }, durationMs: 400 },
      { track: "kick", sound: { kind: "hit" }, durationMs: 114 },
    ]);
    // Every admitted touch sounds on the preview path, on the track's own line.
    expect(preview.notes.map((note) => [note.program.tracks[0]?.name, note.midis, note.seconds])).toEqual([
      ["bass", [52], 0.4],
      ["bass", [53], 0.4],
      ["kick", [HIT_AUDITION_MIDI], 0.114],
    ]);
  });

  it("fills a rest of a pitched track with the bar's first note", () => {
    const { session, controls } = setup();
    controls.tracks.toggleStep("bass", 0, 0);
    expect(line(session, "bass")).toContain("bass  c2 c2 . c2 . c2 . eb2");
    controls.tracks.toggleStep("kick", 0, 1);
    expect(line(session, "kick")).toContain("kick  xx.. x... x... x...");
  });

  it("sets the loop length and gives a track 8 bars, then edits a step in bar 5", () => {
    const { session, controls, said } = setup();
    controls.playback.setLoopBars(16);
    expect(session.view().loop).toEqual({ bars: 16, declared: true });
    expect(said).toContain(announcements.loopLength(16));
    controls.tracks.setBars("kick", 8);
    controls.tracks.toggleStep("kick", 4, 1);
    const kick = line(session, "kick").split(" / ");
    expect(kick).toHaveLength(8);
    expect(kick[4]).toContain("xx.. x... x... x...");
    controls.tracks.setStepCount("hat", 32);
    expect(session.view().tracks.find((track) => track.name === "hat")?.bars[0]).toHaveLength(32);
  });
  it("says the loop grew when a longer pattern grows it, and nothing when it fits", () => {
    const { session, controls, said } = setup();
    controls.playback.setLoopBars(2);
    controls.tracks.setBars("kick", 4);
    expect(session.view().loop).toEqual({ bars: 4, declared: true });
    expect(said.at(-1)).toBe(announcements.loopLength(4));
    const count = said.length;
    controls.tracks.setBars("hat", 2);
    expect(said).toHaveLength(count);
  });
  it("adds, duplicates and deletes tracks and reports the names", () => {
    const { session, controls, said } = setup();
    expect(controls.library.addTrack("hat", null)).toBe("hat2");
    expect(controls.tracks.duplicateTrack("bass")).toBe("bass2");
    controls.tracks.deleteTrack("hat2");
    expect(session.view().tracks.map((track) => track.name)).toEqual(["kick", "hat", "ride", "sub", "bass", "bass2"]);
    expect(controls.library.addTrack("theremin", null)).toBe("");
    expect(said).toContain(announcements.failed("UNKNOWN_INSTRUMENT"));
  });

  it("adds a track with a chosen sound, writing the word only when it is not the default", () => {
    const { session, controls } = setup();
    expect(controls.library.addTrack("bass", "dirty")).toBe("bass2");
    expect(line(session, "bass2")).toMatch(/^bass2: bass dirty /);
    expect(controls.library.addTrack("bass", "round")).toBe("bass3");
    expect(line(session, "bass3")).not.toContain("round");
  });
  it("a part's Play repeats it alone from the next bar, and follows it in the export sheet", () => {
    const { session, sound, controls, said } = setup();
    controls.playback.setMode("song");
    controls.range.playPart(2);
    const part = session.view().song?.parts[2];
    const range = { startBar: (part?.start ?? 0) + 1, endBar: (part?.start ?? 0) + (part?.bars ?? 0), cycle: true };
    expect(sound.calls).toContainEqual({ kind: "setPlayRange", change: { mode: "song", range, locate: true } });
    expect(session.state()).toMatchObject({ playing: true, mode: "song" });
    expect(said.at(-1)).toBe(announcements.partRepeats("drop"));
    expect(controls.exporter.view()).toMatchObject({ isPlayRangeChosen: true });
    controls.range.playPart(2);
    expect(said.at(-1)).toBe(announcements.rangeCleared("song"));
  });

  it("toggles section membership through the text", () => {
    const { session, controls } = setup();
    controls.song.toggleSectionMember("intro", "ride");
    expect(session.view().sections[0]?.tracks).toEqual(["kick", "hat", "sub", "ride"]);
  });


  it("edits the song's parts and adds one from what is playing", () => {
    const { session, controls, said } = setup();
    const songLine = (): string => session.state().source.split("\n").find((line) => line.startsWith("song ")) ?? "";
    controls.song.setPartBars(0, 16);
    expect(songLine()).toBe("song intro 16, build 4, drop 16, break 8, build 4, drop 16");
    expect(said.at(-1)).toBe(announcements.partLength("intro", 16));
    controls.song.movePart(1, -1);
    expect(songLine()).toBe("song build 4, intro 16, drop 16, break 8, build 4, drop 16");
    controls.song.duplicatePart(5);
    expect(songLine()).toBe("song build 4, intro 16, drop 16, break 8, build 4, drop 16, drop 16");
    controls.song.addPartFromPlaying();
    expect(said.at(-1)).toBe(announcements.partAdded("part"));
    expect(session.view().sections.at(-1)).toMatchObject({ name: "part", tracks: ["kick", "hat", "ride", "sub", "bass"] });
    controls.song.toggleSectionMember("break", "hat");
    controls.song.toggleSectionMember("break", "bass");
    expect(said.at(-1)).toBe(announcements.partNeedsTrack);
  });

  it("copies bar 1 of a track into its bar 3, and clears a bar", () => {
    const { session, controls } = setup();
    const kick = (): string[] => (session.state().source.split("\n").find((line) => line.startsWith("kick:")) ?? "").split(" / ");
    controls.tracks.setBars("kick", 4);
    controls.tracks.toggleStep("kick", 0, 2);
    expect(controls.tracks.copyBar("kick", 0)).toBe(true);
    controls.tracks.toggleStep("kick", 0, 2);
    controls.tracks.pasteBar("kick", 2);
    expect(kick()[2]).toMatch(/^x\.x\. x\.\.\. x\.\.\. x\.\.\./);
    expect(kick()[0]).toMatch(/x\.\.\. x\.\.\. x\.\.\. x\.\.\./);
    controls.tracks.clearBar("kick", 2);
    expect(kick()[2]).toMatch(/^\.\.\.\. \.\.\.\. \.\.\.\. \.\.\.\./);
    expect(controls.tracks.copyBar("kick", 9)).toBe(false);
  });

  it("keeps the export format as page state and emits a new view", () => {
    const { controls } = setup();
    const formats: string[] = [];
    controls.view.subscribe((view) => formats.push(view.export.format));
    controls.exporter.selectExportFormat("audio");
    expect(formats).toEqual(["audio"]);
    controls.dispose();
    controls.exporter.selectExportFormat("video");
    expect(formats).toEqual(["audio"]);
  });

  it("tells a change listener without describing the view (the page draws once per frame)", () => {
    const { controls, session } = setup();
    const views = vi.spyOn(session, "view");
    let changes = 0;
    controls.view.onChange(() => (changes += 1));
    controls.exporter.selectExportFormat("audio");
    controls.exporter.selectExportFormat("video");
    expect(changes).toBe(2);
    expect(views).not.toHaveBeenCalled();
    // A view listener still gets the described view on every change.
    controls.view.subscribe(() => undefined);
    controls.exporter.selectExportFormat("audio");
    expect(views).toHaveBeenCalled();
  });
});
