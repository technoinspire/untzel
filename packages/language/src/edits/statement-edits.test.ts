// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { setStepCount, setTrackBars } from "./length-edits";
import { setKey, setSection, setSong, setTempo } from "./statement-edits";
import type { EditResult } from "./text-changes";
import { setTrackModifier } from "./track-edits";
import { readNames } from "../vocabulary/names";

// The edits of the composer terminal: only the touched tokens
// change; comments and spacing stay as written.

const SONG = `// my song
tempo 132 // fast
key c minor
kick:  kick  x... x... x... x...   | drive 0.3   // the floor
bass:  bass  . c2 . c2 . c2 . eb2  | cutoff 900  // low end
section intro  kick
section drop   kick   bass // all
song intro 8, drop 16 | loop
`;

function text(result: EditResult): string {
  if (!result.ok) throw new Error(result.reason);
  return result.source;
}

describe("setTempo and setKey", () => {
  it("replace the value and keep the comment", () => {
    expect(text(setTempo(SONG, 124))).toBe(SONG.replace("tempo 132 // fast", "tempo 124 // fast"));
    expect(text(setKey(SONG, "f#", "dorian"))).toBe(SONG.replace("key c minor", "key f# dorian"));
  });

  it("insert the statement where the language expects it", () => {
    expect(text(setTempo("// hi\nkick x...", 120))).toBe("// hi\ntempo 120\nkick x...");
    expect(text(setKey("tempo 120\nkick x...", "a", "minor"))).toBe("tempo 120\nkey a minor\nkick x...");
    expect(text(setTempo("", 120))).toBe("tempo 120");
  });

  it("refuse values the language rejects", () => {
    expect(setTempo(SONG, 350)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setKey(SONG, "h", "minor")).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(setKey(SONG, "c", "minr")).toEqual({ ok: false, reason: "INVALID_VALUE" });
  });
});

describe("setSection and setSong", () => {
  it("replace a section's tracks, keeping the comment", () => {
    expect(text(setSection(SONG, "drop", ["bass"]))).toBe(SONG.replace("section drop   kick   bass // all", "section drop   bass // all"));
  });

  it("add a section after the last one", () => {
    expect(text(setSection(SONG, "break", ["bass", "bass"]))).toBe(
      SONG.replace("section drop   kick   bass // all\n", "section drop   kick   bass // all\nsection break bass\n"),
    );
  });

  it("refuse unknown tracks and bad names", () => {
    expect(setSection(SONG, "break", ["acid"])).toEqual({ ok: false, reason: "UNKNOWN_TRACK" });
    expect(setSection(SONG, "Break", ["kick"])).toEqual({ ok: false, reason: "INVALID_NAME" });
  });

  it("replace the parts and keep | loop", () => {
    expect(text(setSong(SONG, [{ section: "drop", bars: 4 }, { section: "intro", bars: 2 }]))).toBe(
      SONG.replace("song intro 8, drop 16 | loop", "song drop 4, intro 2 | loop"),
    );
    expect(setSong(SONG, [{ section: "chorus", bars: 4 }])).toEqual({ ok: false, reason: "UNKNOWN_SECTION" });
  });

  it("write a song at the end when there is none", () => {
    expect(text(setSong("kick x...\nsection a kick", [{ section: "a", bars: 8 }]))).toBe("kick x...\nsection a kick\nsong a 8");
  });
});

describe("setTrackModifier", () => {
  it("writes a signal with its range, keeping the comment", () => {
    expect(text(setTrackModifier(SONG, "bass", "cutoff", "sine(8) 300..2400"))).toBe(
      SONG.replace("| cutoff 900  // low end", "| cutoff sine(8) 300..2400  // low end"),
    );
  });

  it("appends names, divisions and flags", () => {
    expect(text(setTrackModifier("kick x...", "kick", "reverb", "sea"))).toBe("kick x... | reverb sea");
    expect(text(setTrackModifier("kick x...", "kick", "delay", "1/8"))).toBe("kick x... | delay 1/8");
    expect(text(setTrackModifier("kick x...", "kick", "free", null))).toBe("kick x... | free");
  });

  it("refuses a value longer than any modifier value before matching it", () => {
    const value = `sine(8) 1${".".repeat(5_000)}`;
    const started = performance.now();
    expect(setTrackModifier("kick x...", "kick", "cutoff", value)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    expect(performance.now() - started).toBeLessThan(50);
  });
  it("never lets a value add another modifier or line", () => {
    for (const value of ["1 | mute", "1\nhat x...", "1 // hi", ""]) {
      expect(setTrackModifier(SONG, "kick", "gain", value)).toEqual({ ok: false, reason: "INVALID_VALUE" });
    }
  });
});

describe("setStepCount and setTrackBars", () => {
  it("doubles steps keeping every hit in time", () => {
    expect(text(setStepCount("kick: kick x... x...", "kick", 16, false))).toBe("kick: kick x... .... x... ....");
  });

  it("holds notes of a pitched track and halves without moving steps", () => {
    expect(text(setStepCount("b: bass c2 . eb2 .", "b", 8, true))).toBe("b: bass c2 ~ . . eb2 ~ . .");
    expect(text(setStepCount("b: bass c2 . eb2 . g1 . . .", "b", 4, true))).toBe("b: bass c2 eb2 g1 .");
  });

  it("repeats the last bar and drops bars", () => {
    expect(text(setTrackBars("kick x... / x.x.", "kick", 3))).toBe("kick x... / x.x. / x.x.");
    expect(text(setTrackBars("kick x... / x.x. // two", "kick", 1))).toBe("kick x... // two");
  });
});

describe("readNames", () => {
  it("reads tracks and sections even with errors", () => {
    const names = readNames("kick x...\nhat x ]\nhat x...\nsection drop kick hat");
    expect(names.tracks.map((track) => track.name)).toEqual(["kick", "hat", "hat2"]);
    expect(names.sections).toEqual([{ name: "drop", tracks: ["kick", "hat"], line: 4 }]);
  });
});
