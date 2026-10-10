// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { PlaybackPosition } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { presentView, type PresentContext } from "./present-view";
import { FAKE_DESCRIPTIONS, FAKE_LABELS, sessionFixture } from "./testing/session-fixture";
import { NO_PROJECT, type ExportStretchView } from "./view-model";
import { IDLE_EXPORT, IDLE_SHARE } from "./waiting-view";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
const TEXT = `tempo 124
key c minor
kick: kick x... x... x... x...
bass: bass . c2 . eb2
section groove kick | loop
section drop kick bass
song groove 4, drop 8
`;
const stretch: ExportStretchView = {
  mode: "loop",
  lastBar: 4,
  parts: [],
  startTick: 0,
  endTick: 256,
  timeMap: [{ startBar: 0, startSeconds: 0, secondsPerBar: 2 }],
  capSeconds: 60,
  isFine: false,
  playheadBar: null,
  isListening: false,
  hasPlayRange: false,
  isReset: true,
  playRangeLabel: null,
};
const context: PresentContext = {
  registry: fixture.registry,
  audition: null,
  templates: { blank: null, styles: [], projects: [] },
  selectedTemplate: "house/disco-lights",
  share: IDLE_SHARE,
  export: { ...IDLE_EXPORT, stretch },
  playRange: { mode: "loop", range: null, loop: null, song: null, lastBar: 4, songNames: null, notice: null },
  nowFrame: null,
  sampleRate: 48_000,
  labels: FAKE_LABELS,
  descriptions: FAKE_DESCRIPTIONS,
};
describe("presentView", () => {
  it("composes the running view: tracks, song, scale, starters, the sheets and no project", () => {
    const view = presentView(fixture.viewOf(TEXT), context);
    expect(view.phase).toBe("running");
    expect(view.tracks.map((track) => track.name)).toEqual(["kick", "bass"]);
    expect(view.song).toEqual({
      sections: [
        { name: "groove", tracks: ["kick"] },
        { name: "drop", tracks: ["kick", "bass"] },
      ],
      parts: [
        { section: "groove", bars: 4, start: 0 },
        { section: "drop", bars: 8, start: 4 },
      ],
      currentPart: null,
      playheadBar: null,
    });
    expect(view.scale).toEqual({ label: "c minor", notes: ["c", "d", "eb", "f", "g", "ab", "bb"] });
    expect(view.starters).toEqual(["kick", "bass", "hat", "pad"]);
    expect(view.library.map((entry) => entry.description)[0]).toBe(`acid: ${fixture.registry.get("acid")?.description}`);
    expect(view.templates).toEqual({ catalog: context.templates, selected: "house/disco-lights", openStyle: null, notice: null });
    expect(view.share).toBe(IDLE_SHARE);
    expect(view.history).toEqual({ canUndo: false, canRedo: false });
    expect(view.project).toBe(NO_PROJECT);
    expect(view.audition).toBeNull();
  });
  it("moves the export's playhead with the loop that plays, and the song's playhead in song mode", () => {
    const { session, sound } = fixture.sessionOf(TEXT);
    session.play("loop");
    const at: PlaybackPosition = { frame: 0, bar: 2, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar: 2, loopBar: 2, loopBars: 4, framesPerBar: 1_000 };
    sound.emitPosition(at);
    const view = presentView(session.view(), context);
    expect(view.transport.loopBar).toBe(3);
    expect(view.export.stretch?.playheadBar).toBe(3);
    expect(view.song.playheadBar).toBeNull();
    session.setMode("song");
    sound.emitPosition({ ...at, mode: "song", partIndex: 1, section: "drop", barInPart: 2, totalBars: 12 });
    expect(presentView(session.view(), context).song.playheadBar).toBe(6);
  });
});
