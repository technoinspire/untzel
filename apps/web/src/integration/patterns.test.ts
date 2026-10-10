// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { midiToNoteName, type Key } from "@untzel/core";
import { analyze, patternInKey } from "@untzel/language";
import type { PatternAtom, PatternElement } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";

// The named starting patterns of every manifest: 4 to 6 per
// instrument (1 to 3 for FX), written in c minor, and good in every key: moved to each of
// the 12 tonics by patternInKey they analyze on their instrument without a diagnostic and
// stay inside its playable range. A pattern uses chords or notes, never both:
// a chord root has no octave, so moving both would change the distance between them.

const TONICS: readonly Key[] = Array.from({ length: 12 }, (_, tonic) => ({ tonic, scale: "minor" }));

function atoms(elements: readonly PatternElement[]): PatternAtom[] {
  return elements.flatMap((element) => (element.kind === "group" ? atoms(element.elements) : [element]));
}

describe("the named patterns of every instrument", () => {
  const { registry, instruments } = buildRegistry();

  it("are 4 to 6 per instrument and 1 to 3 per FX, with unique names", () => {
    for (const manifest of instruments) {
      const [low, high] = manifest.group === "fx" ? [1, 3] : [4, 6];
      expect(manifest.patterns.length, manifest.name).toBeGreaterThanOrEqual(low);
      expect(manifest.patterns.length, manifest.name).toBeLessThanOrEqual(high);
      expect(new Set(manifest.patterns.map((pattern) => pattern.name)).size, manifest.name).toBe(manifest.patterns.length);
      expect(manifest.defaultPattern, manifest.name).toBe(manifest.patterns[0]?.text);
    }
  });

  it("analyze in all 12 keys without a diagnostic, inside the instrument's range", () => {
    for (const manifest of instruments) {
      for (const pattern of manifest.patterns) {
        for (const key of TONICS) {
          const label = `${manifest.name} · ${pattern.name} · tonic ${key.tonic}`;
          const text = patternInKey(pattern.text, manifest.kind, key);
          expect(text, label).not.toBeNull();
          const result = analyze(`key ${midiToNoteName(key.tonic + 12)?.replace(/\d$/, "") ?? "c"} minor\nt: ${manifest.name} ${text ?? ""}`, registry);
          expect(result.ok ? result.warnings : result.diagnostics, label).toEqual([]);
          if (!result.ok || manifest.range === null) continue;
          const { lowest, highest } = manifest.range;
          const midis = (result.program.tracks[0]?.pattern.bars ?? []).flatMap((bar) => atoms(bar.elements)).flatMap((atom) =>
            atom.kind === "note" ? [atom.midi] : atom.kind === "stack" || atom.kind === "chord" ? atom.midis : [],
          );
          for (const midi of midis) {
            expect(midi, label).toBeGreaterThanOrEqual(lowest);
            expect(midi, label).toBeLessThanOrEqual(highest);
          }
        }
      }
    }
  });

  it("use chords or notes, never both", () => {
    for (const manifest of instruments) {
      for (const pattern of manifest.patterns) {
        const result = analyze(`t: ${manifest.name} ${pattern.text}`, registry);
        if (!result.ok) throw new Error(`${manifest.name} · ${pattern.name}`);
        const kinds = new Set((result.program.tracks[0]?.pattern.bars ?? []).flatMap((bar) => atoms(bar.elements)).map((atom) => atom.kind));
        expect(kinds.has("chord") && (kinds.has("note") || kinds.has("stack")), `${manifest.name} · ${pattern.name}`).toBe(false);
      }
    }
  });
});
