// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { AuditionVoices, HIT_AUDITION_MIDI, RETRIGGER_MS, SUSTAINED_AUDITION_MS, auditionDurationMs, auditionKey, auditionMidis } from "./audition";

describe("audition rules", () => {
  it("lasts about one step for drums and 400 ms for the others", () => {
    expect(auditionDurationMs("drum", 120)).toBe(125);
    expect(auditionDurationMs("pitched", 120)).toBe(SUSTAINED_AUDITION_MS);
    expect(auditionDurationMs("chord", 90)).toBe(SUSTAINED_AUDITION_MS);
  });

  it("keeps one voice per track: a drag plays each new note once", () => {
    const voices = new AuditionVoices();
    const c3 = { kind: "note", note: "c3" } as const;
    const d3 = { kind: "note", note: "d3" } as const;
    expect(voices.admit("bass", c3, 0)).toBe(true);
    expect(voices.admit("bass", c3, 10)).toBe(false);
    expect(voices.admit("bass", d3, 20)).toBe(true);
    expect(voices.admit("bass", c3, 30)).toBe(true);
    expect(voices.admit("lead", c3, 30)).toBe(true);
    expect(voices.admit("bass", c3, 30 + RETRIGGER_MS)).toBe(true);
  });

  it("tells chords apart by root and quality", () => {
    expect(auditionKey({ kind: "chord", root: "F", quality: "m7" })).not.toBe(auditionKey({ kind: "chord", root: "F", quality: "m" }));
  });
});

describe("audition keys", () => {
  it("a note is its key, a chord the engine's voicing, a hit the DSP's hit note", () => {
    expect(auditionMidis({ kind: "note", note: "e3" })).toEqual([52]);
    expect(auditionMidis({ kind: "chord", root: "F", quality: "m7" })).toEqual([53, 56, 60, 63]);
    expect(auditionMidis({ kind: "hit" })).toEqual([HIT_AUDITION_MIDI]);
  });
});
