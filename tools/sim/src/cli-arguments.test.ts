// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every option of the usage line, read through the one table.
import { describe, expect, it } from "vitest";
import { OPTIONS, UsageError, parseArguments } from "./cli-arguments";

const USAGE = [
  "--bars", "--seconds", "--tracks", "--out", "--seed", "--mode", "--section", "--rounds", "--clock", "--no-samples",
  "--range", "--range-at", "--cycle", "--scale", "--costs", "--levels", "--gain", "--capacity", "--timbre",
  "--fail-closed", "--only", "--templates", "--take", "--from-arm", "--golden", "--update",
];

describe("parseArguments", () => {
  it("has a reader for every option of the usage line, and no other", () => {
    expect(Object.keys(OPTIONS).sort()).toEqual([...USAGE].sort());
  });

  it("reads the defaults with a file alone", () => {
    expect(parseArguments(["a.untzel"])).toEqual({
      file: "a.untzel", bars: null, seconds: null, tracks: null, out: null, seed: null, mode: "loop",
      scale: false, golden: false, update: false, costs: false, levels: false, gain: false, capacity: null,
      section: null, rounds: 7, clock: "wall", samples: true, range: null, rangeAt: null, timbre: false,
      failClosed: false, only: null, templates: false, take: null, fromArm: false,
    });
  });

  it("reads the values of the file options", () => {
    const argv = ["a.untzel", "--seconds", "2.5", "--tracks", "8", "--out", "dir", "--seed", "7", "--mode", "song", "--section", "all", "--rounds", "3", "--clock", "cpu", "--no-samples"];
    expect(parseArguments(argv)).toMatchObject({ seconds: 2.5, tracks: 8, out: "dir", seed: 7, mode: "song", section: "all", rounds: 3, clock: "cpu", samples: false });
    expect(parseArguments(["a.untzel", "--bars", "4"]).bars).toBe(4);
  });

  it("reads the play range with its hand-in time and cycle", () => {
    expect(parseArguments(["a.untzel", "--range", "3-6"]).range).toEqual({ startBar: 3, endBar: 6, cycle: true });
    expect(parseArguments(["a.untzel", "--cycle", "off", "--range", "3-6", "--range-at", "4"])).toMatchObject({ range: { startBar: 3, endBar: 6, cycle: false }, rangeAt: 4 });
    expect(parseArguments(["a.untzel", "--cycle", "on"]).range).toBeNull();
  });

  it.each([
    ["--scale", { scale: true }],
    ["--costs", { costs: true }],
    ["--levels", { levels: true }],
    ["--gain", { gain: true }],
    ["--timbre", { timbre: true }],
    ["--templates", { templates: true }],
    ["--golden", { golden: true }],
  ] as const)("%s runs without a file", (option, expected) => {
    expect(parseArguments([option])).toMatchObject({ ...expected, file: null });
  });

  it("reads the measurement and golden modifiers", () => {
    expect(parseArguments(["--capacity", "1.5"])).toMatchObject({ capacity: 1.5, file: null });
    expect(parseArguments(["--timbre", "--fail-closed", "--only", "piano,kick"])).toMatchObject({ failClosed: true, only: new Set(["piano", "kick"]) });
    expect(parseArguments(["--golden", "--update"])).toMatchObject({ golden: true, update: true });
    expect(parseArguments(["--take", "take.json", "--from-arm"])).toMatchObject({ take: "take.json", fromArm: true, file: null });
  });

  it.each([
    [["a.untzel", "--bars", "1.5"], "--bars needs a positive integer"],
    [["a.untzel", "--seconds", "0"], "--seconds needs a positive number"],
    [["a.untzel", "--mode", "jam"], "--mode is loop or song"],
    [["a.untzel", "--clock", "sun"], "--clock is wall or cpu"],
    [["a.untzel", "--cycle", "maybe"], "--cycle is on or off"],
    [["a.untzel", "--range", "6-3"], "--range is A-B, 1 ≤ A ≤ B"],
    [["a.untzel", "--section", "--bars"], "--section needs a name or all"],
    [["--timbre", "--only"], "--only needs instrument names, comma separated"],
    [["--take"], "--take needs a take.json file"],
    [["a.untzel", "--loud"], "unknown option --loud"],
    [["a.untzel", "--bars", "4", "--seconds", "2"], "use --bars or --seconds, not both"],
    [["a.untzel", "--from-arm"], "--from-arm needs --take <file>"],
    [[], "missing <file.untzel>"],
  ])("refuses %j", (argv, message) => {
    expect(() => parseArguments(argv)).toThrow(new UsageError(message));
  });

  it("takes a word that only an inherited key would match as the file", () => {
    expect(parseArguments(["toString"]).file).toBe("toString");
  });
});
