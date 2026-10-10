// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { HIT_AUDITION_MIDI } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { PreviewNoteAudition, type NotePlayer } from "./note-audition";

class RecordingPlayer implements NotePlayer {
  readonly played: { readonly track: string; readonly midis: readonly number[]; readonly seconds: number }[] = [];
  playNote(track: string, midis: readonly number[], seconds: number): boolean {
    this.played.push({ track, midis, seconds });
    return true;
  }
}

describe("PreviewNoteAudition", () => {
  it("sends every touch to the preview path: the keys of the sound, in seconds", () => {
    const player = new RecordingPlayer();
    const audition = new PreviewNoteAudition(player);
    audition.audition("bass", { kind: "note", note: "c2" }, 400);
    audition.audition("keys", { kind: "chord", root: "C", quality: "major" }, 400);
    audition.audition("kick", { kind: "hit" }, 125);
    expect(player.played).toEqual([
      { track: "bass", midis: [36], seconds: 0.4 },
      { track: "keys", midis: [48, 52, 55], seconds: 0.4 },
      { track: "kick", midis: [HIT_AUDITION_MIDI], seconds: 0.125 },
    ]);
  });

  it("keeps the latest events for the test hook", () => {
    const audition = new PreviewNoteAudition(new RecordingPlayer());
    for (let index = 0; index < 40; index += 1) audition.audition("kick", { kind: "hit" }, 100 + index);
    expect(audition.events()).toHaveLength(32);
    expect(audition.events()[0]?.durationMs).toBe(108);
  });
});
