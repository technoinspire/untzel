// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// An integration test of the composition: the presenters of @untzel/presentation over the
// app's registry and the template tree of @untzel/sim, which a package may not import.

import { analyze } from "@untzel/language";
import { Session } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { firstTouchTemplate, readTemplateTree } from "@untzel/sim/template-tree";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { curvePosition } from "@untzel/core";
import { barPosition, midiName, presentView, type PresentContext } from "@untzel/presentation";
import { IDLE_EXPORT, IDLE_SHARE } from "@untzel/presentation/waiting";
import { PRESENTATION_COPY } from "../adapters/presentation-copy";

// The phase 1 cases read the phase 1 onboard, kept as a fixture.
const onboard = readFileSync(new URL("../../../../tools/sim/fixtures/phase1-onboard.untzel", import.meta.url), "utf8");
const { registry } = buildRegistry();

function sessionWith(source: string): Session {
  const session = new Session({
    sound: new FakeSoundPort(),
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    analyze: (text) => analyze(text, registry),
  });
  session.applyText(source);
  return session;
}

const context: PresentContext = {
  registry,
  audition: null,
  templates: { blank: null, styles: [], projects: [] },
  selectedTemplate: "phase1-onboard",
  share: IDLE_SHARE,
  export: IDLE_EXPORT,
  playRange: { mode: "loop", range: null, loop: null, song: null, lastBar: 4, songNames: null, notice: null },
  nowFrame: null,
  sampleRate: 48_000,
  labels: PRESENTATION_COPY.labels,
  descriptions: PRESENTATION_COPY.descriptions,
};

describe("presentView over the phase 1 onboard", () => {
  const view = presentView(sessionWith(onboard).view(), context);

  it("lists the five tracks with their manifest group and kind", () => {
    expect(view.tracks.map((track) => [track.name, track.group, track.kind])).toEqual([
      ["kick", "drums", "drum"],
      ["hat", "drums", "drum"],
      ["ride", "drums", "drum"],
      ["sub", "bass", "pitched"],
      ["bass", "bass", "pitched"],
    ]);
  });

  it("gives the note picker each instrument's own range, from its manifest", () => {
    for (const track of view.tracks.filter((entry) => entry.kind !== "drum")) {
      expect(track.pitchRange, track.name).toEqual(registry.get(track.instrument)?.range);
      expect(track.pitchRange, track.name).not.toEqual({ lowest: 12, highest: 96 });
    }
  });

  it("names notes with c4 = 60 and keeps the step order of the text", () => {
    const bass = view.tracks.find((track) => track.name === "bass");
    expect(bass?.steps.map((step) => step.label ?? step.kind)).toEqual([
      "rest", "c2", "rest", "c2", "rest", "c2", "rest", "eb2",
    ]);
    expect(midiName(24)).toBe("c1");
  });

  it("maps parameters through the manifest curve and shows the signal range", () => {
    const sub = view.tracks.find((track) => track.name === "sub");
    const cutoff = sub?.sound.find((parameter) => parameter.name === "cutoff");
    expect(cutoff?.display).toBe("180 Hz");
    expect(cutoff?.fraction).toBeCloseTo(Math.log(180 / 40) / Math.log(8000 / 40), 6);
    const bassCutoff = view.tracks.find((track) => track.name === "bass")?.sound[0];
    expect(bassCutoff?.display).toBe("sine 8 bars · 300 Hz–1400 Hz");
    expect(bassCutoff?.signal?.from).toBeCloseTo(curvePosition("exponential", 40, 8000, 300), 6);
  });

  it("reads pan as left/right and keeps the scale of the key", () => {
    const ride = view.tracks.find((track) => track.name === "ride");
    expect(ride?.mix.find((parameter) => parameter.name === "pan")?.display).toBe("left 30");
    expect(view.scale).toEqual({ label: "c minor", notes: ["c", "d", "eb", "f", "g", "ab", "bb"] });
  });

  it("describes the song: four sections and six parts over 56 bars", () => {
    expect(view.song.sections.map((section) => section.name)).toEqual(["intro", "build", "drop", "break"]);
    expect(view.song.parts.reduce((sum, part) => sum + part.bars, 0)).toBe(56);
  });

  it("shows the tone of sub from the cutoff it sets", () => {
    const sub = view.tracks.find((track) => track.name === "sub");
    expect(sub?.tone).toBeCloseTo(Math.log(180 / 120) / Math.log(3000 / 120), 6);
  });
});

describe("presentView over the first-touch template (Midnight Bloom)", () => {
  const melodic = firstTouchTemplate(readTemplateTree(fileURLToPath(new URL("../../../../", import.meta.url)))).text;
  const view = presentView(sessionWith(melodic).view(), context);

  it("shows twenty tracks, ten sections and eleven parts over 200 bars", () => {
    expect(view.tracks).toHaveLength(20);
    expect(view.song.sections).toHaveLength(10);
    expect(view.song.parts).toHaveLength(11);
    expect(view.song.parts.reduce((bars, part) => bars + part.bars, 0)).toBe(200);
  });
});

describe("barPosition", () => {
  it("counts whole bars past the reported boundary and the fraction of the current one", () => {
    const position = { frame: 48_000, bar: 4, mode: "loop", partIndex: null, section: null, barInPart: null, totalBars: null, patternBar: 0, loopBar: null, loopBars: null, framesPerBar: 96_000 } as const;
    const barFrames = (240 * 48_000) / 120;
    expect(barPosition(position, 120, 48_000 + barFrames * 1.25, 48_000)).toEqual({ bar: 5, fraction: 0.25 });
    expect(barPosition(position, 120, null, 48_000)).toEqual({ bar: 4, fraction: 0 });
  });
});
