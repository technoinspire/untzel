// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { AnalyzeResult } from "@untzel/language";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { Session } from "./use-cases/session";
import { soloProgram } from "./edits/solo";
import { soundingProgram, type SoundingRecipe } from "./sounding-program";
import { previewProgram } from "./audition/track-preview";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "./testing";

const LOOP = fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: ["..x."] })]);
const BROKEN_HAT = fakeProgram([fakeTrack("kick"), fakeTrack("hat", { bars: ["x.xx"] })]);
const KICK_ONLY = fakeProgram([fakeTrack("kick")]);
const TABLE: Readonly<Record<string, Program>> = { loop: LOOP, broken: BROKEN_HAT, "kick only": KICK_ONLY };

function analyze(source: string): AnalyzeResult {
  const program = TABLE[source];
  if (program === undefined) return { ok: false, diagnostics: [] };
  return { ok: true, program, warnings: [] };
}

/** Session.#loadSound before soundingProgram existed, kept as the reference. */
function loadSoundBefore(program: Program, solo: string | null, preview: { track: string; program: Program } | null): Program {
  const previewed = preview === null ? program : previewProgram(program, preview.track, preview.program);
  return solo === null ? previewed : soloProgram(previewed, solo);
}

/** Analyzes a recipe back into the program it names. */
function materialize(recipe: SoundingRecipe): Program {
  const preview = recipe.preview === null ? null : { track: recipe.preview.track, program: analyzed(recipe.preview.text) };
  return soundingProgram({ program: analyzed(recipe.source), solo: recipe.solo, preview });
}

function analyzed(source: string): Program {
  const result = analyze(source);
  if (!result.ok) throw new Error(`does not analyze: ${source}`);
  return result.program;
}

function setup() {
  const sound = new FakeSoundPort();
  const session = new Session({ sound, load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze });
  session.applyText("loop");
  return { session, sound };
}

const SOLOS = [null, "kick", "hat"] as const;
const PREVIEWS = [null, { track: "hat", program: BROKEN_HAT }] as const;

describe("soundingProgram", () => {
  it("gives what the session loaded before, over solo x preview", () => {
    for (const solo of SOLOS) {
      for (const preview of PREVIEWS) {
        expect(soundingProgram({ program: LOOP, solo, preview })).toEqual(loadSoundBefore(LOOP, solo, preview));
      }
    }
  });
  it("returns the program itself with neither solo nor preview", () => {
    expect(soundingProgram({ program: LOOP, solo: null, preview: null })).toBe(LOOP);
  });
});

describe("Session.soundingRecipe", () => {
  it("is null without a program", () => {
    const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze });
    expect(session.soundingRecipe()).toBeNull();
  });
  it("materializes into the last program sent to load, over solo x preview", () => {
    for (const solo of SOLOS) {
      for (const isPreviewing of [false, true]) {
        const { session, sound } = setup();
        if (isPreviewing) expect(session.previewTrack("hat", "broken", "Broken")).toEqual({ ok: true });
        session.solo(solo);
        const recipe = session.soundingRecipe();
        if (recipe === null) throw new Error("no recipe");
        expect(recipe.solo).toBe(solo);
        expect(recipe.preview).toEqual(isPreviewing ? { track: "hat", text: "broken" } : null);
        expect(materialize(recipe)).toEqual(sound.loads().at(-1));
      }
    }
  });
  it("names the last valid source while the text is invalid", () => {
    const { session, sound } = setup();
    session.applyText("loop typo");
    const recipe = session.soundingRecipe();
    expect(recipe?.source).toBe("loop");
    if (recipe === null) throw new Error("no recipe");
    expect(materialize(recipe)).toEqual(sound.loads().at(-1));
  });
  it("has no preview once another text opens", () => {
    const { session } = setup();
    session.previewTrack("hat", "broken", "Broken");
    session.openText("kick only");
    expect(session.soundingRecipe()?.preview).toBeNull();
  });
  it("previews the program the analysis of the candidate text gives", () => {
    const { session, sound } = setup();
    session.previewTrack("hat", "broken", "Broken");
    const text = session.soundingRecipe()?.preview?.text ?? "";
    expect(sound.loads().at(-1)?.tracks[1]).toBe(analyzed(text).tracks[1]);
  });
});
