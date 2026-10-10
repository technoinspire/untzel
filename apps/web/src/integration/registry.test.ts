// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MIN_RANGE_SEMITONES, instrumentId, noteNameToMidi } from "@untzel/core";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { CALIBRATION_INSTRUMENTS, calibrationSource } from "../diagnostics/calibration";
import { buildRegistry } from "@untzel/instrument-index";

describe("instrument registry of this build", () => {
  it("orders instrumentId by name, as packages/dsp/build.rs does", () => {
    const { registry, instruments } = buildRegistry();
    const names = instruments.map((manifest) => manifest.name);
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(instruments.map((manifest) => instrumentId(registry, manifest.name))).toEqual(names.map((_, index) => index));
  });

  it("analyzes every defaultPattern without a diagnostic", () => {
    const { registry, instruments } = buildRegistry();
    for (const manifest of instruments) {
      const result = analyze(`t: ${manifest.name} ${manifest.defaultPattern}`, registry);
      expect(result.ok ? result.warnings : result.diagnostics).toEqual([]);
    }
  });

  it("gives every pitched and chord instrument a playable range that holds its own notes", () => {
    const { instruments } = buildRegistry();
    for (const manifest of instruments) {
      if (manifest.kind === "drum") {
        expect(manifest.range, manifest.name).toBeNull();
        continue;
      }
      const range = manifest.range;
      if (range === null) throw new Error(`${manifest.name} has no range`);
      expect(range.highest - range.lowest, manifest.name).toBeGreaterThanOrEqual(MIN_RANGE_SEMITONES);
      const notes = `${manifest.defaultPattern} ${manifest.preview}`.split(/[\s/+[\]]+/).flatMap((word) => {
        const midi = noteNameToMidi(word.replace(/[!~]+$/, ""));
        return midi === null ? [] : [midi];
      });
      for (const midi of notes) {
        expect(midi, `${manifest.name} note ${midi}`).toBeGreaterThanOrEqual(range.lowest);
        expect(midi, `${manifest.name} note ${midi}`).toBeLessThanOrEqual(range.highest);
      }
    }
  });
  it("calls chord only an instrument with voices for a chord", () => {
    const { instruments } = buildRegistry();
    for (const manifest of instruments.filter((entry) => entry.kind === "chord")) {
      expect(manifest.voices, manifest.name).toBeGreaterThanOrEqual(4);
    }
  });
  it("builds a valid calibration text with 4 instances of one instrument per engine", () => {
    const { registry, instruments } = buildRegistry();
    const result = analyze(calibrationSource(instruments), registry);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.program.tracks).toHaveLength(4 * CALIBRATION_INSTRUMENTS.length);
    const engines = new Set(CALIBRATION_INSTRUMENTS.map((name) => registry.get(name)?.engine));
    expect(engines).toEqual(new Set(["legacy", "va", "fm", "additive", "string", "modal", "formant", "percussion"]));
  });
});
