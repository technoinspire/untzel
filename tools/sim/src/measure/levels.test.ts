// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { kickLevelProblem, levelProblem, soundText, withKickRule, type SoundLevel } from "./levels";
import { simRegistry } from "../registry";

describe("level rule", () => {
  it("checks RMS and headroom for pitched and chord instruments", () => {
    expect(levelProblem("piano", "chord", -19, -4)).toBeNull();
    expect(levelProblem("piano", "chord", -19, -2.9)).toMatch(/peak/);
    expect(levelProblem("piano", "chord", -15.9, -20)).toMatch(/RMS/);
    expect(levelProblem("lead", "pitched", -22.1, -20)).toMatch(/RMS/);
    // A sparse stab already at the ceiling may stay under the RMS window.
    expect(levelProblem("stab", "chord", -27, -3.5)).toBeNull();
  });

  it("checks the peak for drum and fx instruments", () => {
    expect(levelProblem("clap", "drum", -40, -6)).toBeNull();
    expect(levelProblem("clap", "drum", -20, -2.9)).toMatch(/peak/);
    expect(levelProblem("riser", "drum", -20, -9.1)).toMatch(/peak/);
  });

  it("leaves hat and bass at their original level and the kick to its own rule", () => {
    expect(levelProblem("hat", "drum", -40, -14)).toBeNull();
    expect(levelProblem("bass", "pitched", -25, -1)).toBeNull();
    expect(levelProblem("kick", "drum", -15, -1)).toBeNull();
  });
  it("keeps every kick sound around the default kick", () => {
    expect(kickLevelProblem(-14.2, -4, -15.4)).toBeNull();
    expect(kickLevelProblem(-13.8, -4, -15.4)).toMatch(/RMS/);
    expect(kickLevelProblem(-15, -0.9, -15.4)).toMatch(/peak/);
    // A short kick already at the ceiling may sit under the window; a quiet one may not.
    expect(kickLevelProblem(-24.8, -1.1, -15.4)).toBeNull();
    expect(kickLevelProblem(-24.8, -6, -15.4)).toMatch(/RMS/);
  });
  it("judges the kick sounds against the default one, which passes as the reference", () => {
    const sound = (preset: string, rmsDbfs: number, peakDbfs: number): SoundLevel => ({ instrument: "kick", kind: "drum", preset, rmsDbfs, peakDbfs, problem: null });
    const judged = withKickRule([sound("punch", -15.4, -0.8), sound("dark", -5, 0.6), sound("boom", -14.5, -3)], "punch");
    expect(judged.map((level) => level.problem === null)).toEqual([true, false, true]);
  });

  it("writes the sound word only when it is not the default", () => {
    const piano = simRegistry().registry.get("piano");
    if (piano === undefined) throw new Error("no piano");
    expect(soundText(piano, piano.defaultPreset)).toContain(`p: piano ${piano.preview}`);
    expect(soundText(piano, "bright")).toContain(`p: piano bright ${piano.preview}`);
  });
});
