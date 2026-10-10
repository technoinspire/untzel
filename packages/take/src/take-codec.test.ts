// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { rational, type Program } from "@untzel/core";
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";
import { describe, expect, it } from "vitest";
import { MAX_TAKE_ENTRIES, MAX_TAKE_TEXT_CHARS, type Take, type TakeEntry } from "./take";
import { decodeTake, encodeTake, type TakeDecodeFailure } from "./take-codec";

const SR = 48_000;
const ARM = 1_000;
const START = 7_040;
const END = START + 3 * SR;
type Mutable = Record<string, unknown> & { entries: Record<string, unknown>[] };

function sounding(at: number, remove: number, insert: string, frame: number, horizon: number | null = null): TakeEntry {
  return { command: { kind: "sounding", source: { at, remove, insert }, solo: null, preview: null }, frame, horizon };
}
const LOAD = sounding(0, 0, "kick x...", ARM);
const PLAY: TakeEntry = { command: { kind: "play", mode: "loop", startBar: null }, frame: ARM + 10, horizon: null, startFrame: START };
const MODE: TakeEntry = { command: { kind: "mode", mode: "song" }, frame: START + 100, horizon: START + 5_760 };

function take(entries: readonly TakeEntry[] = [LOAD, PLAY, MODE]): Take {
  return { format: "untzel-take", version: 1, sampleRate: SR, armFrame: ARM, endFrame: END, endedBy: "stop", entries, instruments: ["kick"], title: "Night" };
}
/** The take as a plain JSON object, changed by `change`, back to text. */
function changed(change: (file: Mutable) => void, base: Take = take()): string {
  const file = JSON.parse(JSON.stringify(base)) as Mutable;
  change(file);
  return JSON.stringify(file);
}
function entry(file: Mutable, index: number): Record<string, unknown> {
  const found = file.entries[index];
  if (found === undefined) throw new Error(`no entry ${index}`);
  return found;
}
function refused(text: string): TakeDecodeFailure | "accepted" {
  const decoded = decodeTake(text);
  return decoded.ok ? "accepted" : decoded.reason;
}

describe("encodeTake and decodeTake", () => {
  it("round-trips through the string, with the audition's bigints", () => {
    const program = { tracks: [], tempo: rational(132n, 1n), swing: rational(1n, 3n) } as unknown as Program;
    const audition: TakeEntry = { command: { kind: "audition", program }, frame: START + 200, horizon: START + 5_760 };
    const original = take([LOAD, PLAY, MODE, audition]);
    const text = encodeTake(original);
    expect(text).toContain('{"$bigint":"132"}');
    const decoded = decodeTake(text);
    expect(decoded).toEqual({ ok: true, take: original });
  });
  it("calls broken JSON MALFORMED and another file NOT_A_TAKE or UNKNOWN_VERSION", () => {
    expect(refused("{")).toBe("MALFORMED");
    expect(refused('{"$bigint":"1x"}')).toBe("MALFORMED");
    expect(refused("[]")).toBe("NOT_A_TAKE");
    expect(refused("3")).toBe("NOT_A_TAKE");
    expect(refused(changed((file) => (file.format = "untzel-song")))).toBe("NOT_A_TAKE");
    expect(refused(changed((file) => (file.version = 2)))).toBe("UNKNOWN_VERSION");
  });
  it("refuses a file over 64 000 000 characters before parsing it", () => {
    expect(refused(" ".repeat(64_000_001))).toBe("TOO_LARGE");
  });
  it("ignores an unknown field", () => {
    const text = changed((file) => {
      file.future = { anything: true };
      entry(file, 1).note = "later versions add fields";
    });
    const decoded = decodeTake(text);
    expect(decoded).toEqual({ ok: true, take: take() });
  });
});

describe("decodeTake: sample rate and frames", () => {
  const cases: readonly [string, (file: Mutable) => void][] = [
    ["sampleRate under 8 000", (file) => (file.sampleRate = 7_999)],
    ["sampleRate over 192 000", (file) => (file.sampleRate = 192_001)],
    ["sampleRate not an integer", (file) => (file.sampleRate = 44_100.5)],
    ["a negative armFrame", (file) => (file.armFrame = -1)],
    ["endFrame before armFrame", (file) => (file.endFrame = ARM - 1)],
    ["a frame before armFrame", (file) => (entry(file, 0).frame = ARM - 1)],
    ["a frame after endFrame", (file) => (entry(file, 2).frame = END + 1)],
    ["a frame that descends", (file) => (entry(file, 2).frame = ARM + 5)],
    ["a frame not an integer", (file) => (entry(file, 2).frame = START + 0.5)],
    ["a negative horizon", (file) => (entry(file, 0).horizon = -1)],
    ["a startFrame on a command other than play", (file) => (entry(file, 2).startFrame = START + 200)],
    ["a startFrame before its frame", (file) => (entry(file, 1).startFrame = ARM)],
    ["an endedBy of another kind", (file) => (file.endedBy = "crash")],
  ];
  for (const [name, change] of cases) {
    it(`refuses ${name} with MALFORMED`, () => {
      expect(refused(changed(change))).toBe("MALFORMED");
    });
  }
  it("refuses a horizon that descends without a null between, and accepts it after a stop", () => {
    const later: TakeEntry = { command: { kind: "mode", mode: "loop" }, frame: START + 200, horizon: START + 5_000 };
    expect(refused(encodeTake(take([LOAD, PLAY, MODE, later])))).toBe("MALFORMED");
    const stop: TakeEntry = { command: { kind: "stop" }, frame: START + 150, horizon: START + 96_000 };
    const background: TakeEntry = { command: { kind: "background", isHidden: false }, frame: START + 160, horizon: null };
    expect(refused(encodeTake(take([LOAD, PLAY, MODE, stop, background, later])))).toBe("accepted");
  });
});

describe("decodeTake: entries", () => {
  it("wants from 1 to MAX_TAKE_ENTRIES entries", () => {
    expect(refused(changed((file) => (file.entries = [])))).toBe("MALFORMED");
    const many = Array.from({ length: MAX_TAKE_ENTRIES - 2 }, (): TakeEntry => ({ command: { kind: "stop" }, frame: START + 200, horizon: null }));
    expect(refused(encodeTake(take([LOAD, PLAY, ...many])))).toBe("accepted");
    expect(refused(encodeTake(take([LOAD, PLAY, ...many, MODE])))).toBe("TOO_LARGE");
  });
  const cases: readonly [string, (file: Mutable) => void][] = [
    ["an unknown command", (file) => (entry(file, 2).command = { kind: "rewind" })],
    ["a mode other than loop or song", (file) => (entry(file, 2).command = { kind: "mode", mode: "jam" })],
    ["a negative startBar", (file) => (entry(file, 1).command = { kind: "play", mode: "loop", startBar: -1 })],
    ["a range that ends before it starts", (file) => (entry(file, 2).command = { kind: "range", change: { mode: "loop", range: { startBar: 3, endBar: 2, cycle: true }, locate: false } })],
    ["a range from bar 0", (file) => (entry(file, 2).command = { kind: "range", change: { mode: "loop", range: { startBar: 0, endBar: 2, cycle: true }, locate: false } })],
    ["a background without isHidden", (file) => (entry(file, 2).command = { kind: "background" })],
    ["a note audition without notes as integers", (file) => (entry(file, 2).command = { kind: "auditionNote", program: { tracks: [], tempo: {} }, midis: [60.5], seconds: 1 })],
    ["a note audition of no duration", (file) => (entry(file, 2).command = { kind: "auditionNote", program: { tracks: [], tempo: {} }, midis: [60], seconds: 0 })],
    ["an audition without a program", (file) => (entry(file, 2).command = { kind: "audition", program: null })],
  ];
  for (const [name, change] of cases) {
    it(`refuses ${name} with MALFORMED`, () => {
      expect(refused(changed(change))).toBe("MALFORMED");
    });
  }
  it("accepts a range and a play from a bar", () => {
    const range: TakeEntry = { command: { kind: "range", change: { mode: "song", range: { startBar: 2, endBar: 2, cycle: false }, locate: true } }, frame: START + 200, horizon: START + 5_760 };
    const fromBar: TakeEntry = { command: { kind: "play", mode: "song", startBar: 4 }, frame: START + 300, horizon: START + 5_760 };
    expect(refused(encodeTake(take([LOAD, PLAY, MODE, range, fromBar])))).toBe("accepted");
  });
});

describe("decodeTake: texts", () => {
  it("refuses a diff that does not apply with MALFORMED", () => {
    expect(refused(encodeTake(take([LOAD, PLAY, sounding(20, 1, "x", START + 200, START + 5_760)])))).toBe("MALFORMED");
  });
  it("refuses a rebuilt text and a preview of 65 537 characters with TOO_LARGE", () => {
    expect(MAX_SOURCE_LENGTH).toBe(65_536);
    const fits = sounding(9, 0, "x".repeat(MAX_SOURCE_LENGTH - 9), START + 200, START + 5_760);
    expect(refused(encodeTake(take([LOAD, PLAY, fits])))).toBe("accepted");
    const longer = sounding(9, 0, "x".repeat(MAX_SOURCE_LENGTH - 8), START + 200, START + 5_760);
    expect(refused(encodeTake(take([LOAD, PLAY, longer])))).toBe("TOO_LARGE");
    const preview: TakeEntry = {
      command: { kind: "sounding", source: { at: 0, remove: 0, insert: "" }, solo: null, preview: { track: "bass", text: "x".repeat(MAX_SOURCE_LENGTH + 1) } },
      frame: START + 200,
      horizon: START + 5_760,
    };
    expect(refused(encodeTake(take([LOAD, PLAY, preview])))).toBe("TOO_LARGE");
  });
  it("refuses more than MAX_TAKE_TEXT_CHARS of text in all with TOO_LARGE", () => {
    const count = Math.ceil(MAX_TAKE_TEXT_CHARS / MAX_SOURCE_LENGTH);
    const rewrites = Array.from({ length: count }, (_, index) => {
      const letter = index % 2 === 0 ? "a" : "b";
      return sounding(0, index === 0 ? 9 : MAX_SOURCE_LENGTH, letter.repeat(MAX_SOURCE_LENGTH), START + 200 + index, START + 5_760);
    });
    expect(refused(encodeTake(take([LOAD, PLAY, ...rewrites])))).toBe("TOO_LARGE");
    expect(refused(encodeTake(take([LOAD, PLAY, ...rewrites.slice(0, count - 2)])))).toBe("accepted");
  });
});

describe("decodeTake: instruments, title and the stretch", () => {
  const cases: readonly [string, (file: Mutable) => void][] = [
    ["more than 256 instruments", (file) => (file.instruments = Array.from({ length: 257 }, (_, index) => `i${index}`))],
    ["an empty instrument name", (file) => (file.instruments = [""])],
    ["an instrument name over 64 characters", (file) => (file.instruments = ["k".repeat(65)])],
    ["a title over 200 characters", (file) => (file.title = "t".repeat(201))],
    ["a title that is not a text", (file) => (file.title = 7)],
    ["no play that started the music", (file) => delete entry(file, 1).startFrame],
    ["under a second from the first sound to the end", (file) => (file.endFrame = START + SR - 1)],
  ];
  for (const [name, change] of cases) {
    it(`refuses ${name} with MALFORMED`, () => {
      expect(refused(changed(change))).toBe("MALFORMED");
    });
  }
  it("accepts 256 instruments of 64 characters and a null title", () => {
    const text = changed((file) => {
      file.instruments = Array.from({ length: 256 }, (_, index) => `${index}`.padEnd(64, "k"));
      file.title = null;
    });
    expect(refused(text)).toBe("accepted");
  });
});
