// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The deferred port's `controls`: every forwarded intent reaches its group of the running
// controls once attached, and answers today's fallback before.
import { describe, expect, it } from "vitest";
import type { ControlsPort } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";
import { DeferredControlsPort } from "../deferred-controls-port";

type Group = "playback" | "tracks" | "audition" | "library" | "sound" | "song" | "range" | "statements" | "patterns" | "share" | "exporter";

/** member, the running group it reaches, its arity, what it answers before the engine runs. */
const FORWARDED: readonly (readonly [keyof ControlsPort, Group, number, unknown])[] = [
  ["undo", "playback", 0, null],
  ["redo", "playback", 0, null],
  ["togglePlay", "playback", 0, undefined],
  ["stop", "playback", 0, undefined],
  ["setMode", "playback", 1, undefined],
  ["drop", "playback", 0, undefined],
  ["setLoopBars", "playback", 1, undefined],
  ["endGesture", "tracks", 0, undefined],
  ["toggleTrack", "tracks", 1, undefined],
  ["setSolo", "tracks", 2, undefined],
  ["setMute", "tracks", 2, undefined],
  ["setTone", "tracks", 2, undefined],
  ["toggleStep", "tracks", 3, undefined],
  ["setStepPitch", "tracks", 4, undefined],
  ["setScaleLock", "tracks", 2, undefined],
  ["setStepCount", "tracks", 2, undefined],
  ["setBars", "tracks", 2, undefined],
  ["setParameter", "tracks", 3, undefined],
  ["copyBar", "tracks", 2, false],
  ["pasteBar", "tracks", 2, undefined],
  ["clearBar", "tracks", 2, undefined],
  ["duplicateTrack", "tracks", 1, "first"],
  ["renameTrack", "tracks", 2, undefined],
  ["useTone", "tracks", 1, []],
  ["nudgeGain", "tracks", 2, undefined],
  ["resetGain", "tracks", 1, undefined],
  ["deleteTrack", "tracks", 1, undefined],
  ["audition", "audition", 2, undefined],
  ["preview", "library", 3, undefined],
  ["stopPreview", "library", 0, undefined],
  ["addTrack", "library", 3, ""],
  ["startWithSound", "library", 1, ""],
  ["setSound", "sound", 2, undefined],
  ["addEffect", "sound", 2, undefined],
  ["removeEffect", "sound", 2, undefined],
  ["previewTrackSound", "sound", 3, undefined],
  ["setTrackSound", "sound", 3, undefined],
  ["renameSection", "song", 2, undefined],
  ["toggleSectionMember", "song", 2, undefined],
  ["addPartFromPlaying", "song", 0, undefined],
  ["setPartBars", "song", 2, undefined],
  ["movePart", "song", 2, undefined],
  ["duplicatePart", "song", 1, undefined],
  ["setPlayRange", "range", 3, undefined],
  ["clearPlayRange", "range", 0, undefined],
  ["setRangeCycle", "range", 1, undefined],
  ["setRangeToPart", "range", 1, undefined],
  ["extendRangeToPart", "range", 1, undefined],
  ["playFrom", "range", 1, undefined],
  ["playFromPart", "range", 1, undefined],
  ["playPart", "range", 1, undefined],
  ["setTempo", "statements", 1, undefined],
  ["setKey", "statements", 2, undefined],
  ["previewPattern", "patterns", 2, undefined],
  ["usePattern", "patterns", 2, undefined],
  ["endTrackPreview", "patterns", 0, undefined],
  ["prepareShare", "share", 0, undefined],
  ["closeShare", "share", 0, undefined],
  ["shareLink", "share", 0, undefined],
  ["copyLink", "share", 0, undefined],
  ["shareFile", "share", 0, undefined],
  ["selectExportFormat", "exporter", 1, undefined],
  ["selectExportQuality", "exporter", 1, undefined],
  ["setExportRangeMode", "exporter", 1, undefined],
  ["useSelectedRange", "exporter", 0, undefined],
  ["setExportStretch", "exporter", 3, undefined],
  ["setExportFine", "exporter", 1, undefined],
  ["useExportPlayRange", "exporter", 0, undefined],
  ["toggleExportListen", "exporter", 0, undefined],
  ["openExport", "exporter", 0, undefined],
  ["renderExport", "exporter", 0, undefined],
  ["cancelExport", "exporter", 0, undefined],
  ["setExportRange", "exporter", 1, undefined],
  ["shareExport", "exporter", 0, undefined],
  ["downloadExport", "exporter", 0, undefined],
  ["closeExport", "exporter", 0, undefined],
];

/** The page's own intents, which this table does not cover (received.test.ts does). */
const PAGE_MEMBERS = [
  "view",
  "subscribe",
  "onAnnouncement",
  "start",
  "selectTemplate",
  "openTemplateStyle",
  "retry",
  "newProject",
  "openProject",
  "continueProject",
  "renameSong",
  "renameProject",
  "duplicateProject",
  "deleteProject",
  "undoDeleteProject",
  "saveProjectFile",
  "saveProjectNow",
  "saveFile",
  "openFile",
];

function recordingRunning(calls: unknown[][]): RunningControls {
  const group = (name: Group): unknown =>
    new Proxy(
      {},
      {
        get: (_target, member) =>
          (...args: unknown[]) => {
            calls.push([`${name}.${String(member)}`, ...args]);
            return `${name}.${String(member)} answered`;
          },
      },
    );
  const groups: readonly Group[] = ["playback", "tracks", "audition", "library", "sound", "song", "range", "statements", "patterns", "share", "exporter"];
  const view = { view: () => ({}), onChange: () => () => undefined, onAnnouncement: () => () => undefined };
  return Object.fromEntries([["view", view], ...groups.map((name) => [name, group(name)])]) as unknown as RunningControls;
}

function setup() {
  const asked: string[] = [];
  const port = new DeferredControlsPort({
    phase: "idle",
    templates: { blank: null, styles: [], projects: [] },
    choice: { template: "onboard", openStyle: null },
    actions: {
      start: () => undefined,
      retry: () => undefined,
      openFile: () => void asked.push("openWaitingFile"),
      projects: {} as never,
      saveWaitingFile: () => void asked.push("saveWaitingFile"),
    },
    frames: { request: () => 0, cancel: () => undefined },
  });
  return { port, asked };
}

function call(controls: ControlsPort, member: keyof ControlsPort, args: readonly unknown[]): unknown {
  return (controls[member] as (...given: readonly unknown[]) => unknown)(...args);
}

describe("DeferredControlsPort.controls", () => {
  it("holds the forwarded intents and the page's, nothing else", () => {
    const { port } = setup();
    const expected = [...FORWARDED.map(([member]) => member), ...PAGE_MEMBERS].sort();
    expect(Object.keys(port.controls).sort()).toEqual(expected);
  });

  it.each(FORWARDED)("%s answers its fallback before the engine runs, then reaches the running %s", (member, group, arity, fallback) => {
    const { port } = setup();
    const args = ["first", 2, true, "fourth"].slice(0, arity);
    expect(call(port.controls, member, args)).toEqual(fallback);
    const calls: unknown[][] = [];
    port.attach(recordingRunning(calls));
    const answered = call(port.controls, member, args);
    expect(calls).toEqual([[`${group}.${member}`, ...args]]);
    if (fallback !== undefined) expect(answered).toBe(`${group}.${member} answered`);
  });

  it("the library's preview and add pass a null pattern when none is given", () => {
    const { port } = setup();
    const calls: unknown[][] = [];
    port.attach(recordingRunning(calls));
    port.controls.preview("kick", null);
    port.controls.addTrack("kick", null);
    expect(calls).toEqual([
      ["library.preview", "kick", null, null],
      ["library.addTrack", "kick", null, null],
    ]);
  });

  it("saveFile and openFile go to the page while waiting, to the share controls while running", () => {
    const { port, asked } = setup();
    const calls: unknown[][] = [];
    const file = new File([], "song.untzel");
    port.attach(recordingRunning(calls));
    port.controls.saveFile();
    port.controls.openFile(file);
    expect(asked).toEqual(["saveWaitingFile", "openWaitingFile"]);
    port.setPhase("running");
    port.controls.saveFile();
    port.controls.openFile(file);
    expect(calls).toEqual([["share.saveFile"], ["share.openFile", file]]);
  });
});
