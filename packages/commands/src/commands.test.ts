// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { COMMANDS } from "./reading/catalog";
import type { CommandOutcome, Proposal } from "./proposal/outcome";
import { composerOf, ONBOARD } from "./testing/composer";

// Every command, its edit or action, and every error with its suggested line.

const composer = composerOf(registryWith(["kick", "hat", "bass"]));

function run(line: string, source = ONBOARD): CommandOutcome {
  return composer.run(line, source);
}

function proposal(line: string, source = ONBOARD): Proposal {
  const outcome = run(line, source);
  if (outcome.kind !== "edit") throw new Error(`${line}: ${JSON.stringify(outcome)}`);
  return outcome.proposal;
}

function after(line: string, source = ONBOARD): string {
  return proposal(line, source).after;
}

describe("text-changing commands map to minimal edits", () => {
  it("tempo replaces the value only", () => {
    const result = proposal("tempo 124");
    expect(result.after).toBe(ONBOARD.replace("tempo 132", "tempo 124"));
    expect(result.summary).toBe("Tempo 124 BPM.");
    expect(result.needsPreview).toBe(false);
  });

  it("key and loop", () => {
    expect(after("key a dorian")).toBe(ONBOARD.replace("key c minor", "key a dorian"));
    expect(after("loop 8")).toBe(ONBOARD.replace("key c minor\n", "key c minor\nloop 8\n"));
    expect(after("loop 16", "loop 4\nkick x...")).toBe("loop 16\nkick x...");
  });

  it("add writes the default pattern after the last track, with the next free name", () => {
    const result = proposal("add bass");
    // The columns of the track above: "bass:  bass  . c2 ...".
    expect(result.after).toContain("bass2: bass  c2 . . c2 . . c2 .\nsection intro");
    expect(result.summary).toBe("Added bass2 on line 9.");
    expect(result.needsPreview).toBe(false);
  });

  it("add with a name is one edit, aligned as far as the name allows", () => {
    expect(after("add hat shaker")).toContain("shaker: hat  ..x. ..x. ..x. ..x.\n");
    expect(after("add hat sh")).toContain("sh:    hat   ..x. ..x. ..x. ..x.\n");
    expect(after("add hat sh", "kick x...")).toBe("kick x...\nsh: hat ..x. ..x. ..x. ..x.");
  });

  it("duplicate copies the track under the next free name, as the detail's Duplicate", () => {
    const result = proposal("duplicate hat", "kick x...\nhat ..x.");
    expect(result.after).toBe("kick x...\nhat ..x.\nhat2: hat ..x.");
    expect(result.summary).toBe("Copied hat as hat2 on line 3.");
    expect(result.needsPreview).toBe(false);
    expect(run("duplicate hta", "kick x...\nhat ..x.")).toEqual({ kind: "error", message: 'No track named "hta".', suggestion: "duplicate hat" });
  });

  it("remove always previews, and takes the name out of the sections", () => {
    const result = proposal("remove ride");
    expect(result.needsPreview).toBe(true);
    expect(result.after).not.toContain("ride");
    expect(result.diff.map((line) => `${line.kind[0]}${line.line}`)).toEqual(["r6", "r10", "a9", "r11", "a10"]);
  });

  it("rename keeps comments and previews when sections change too", () => {
    const result = proposal("rename bass acid");
    expect(result.after).toContain("acid:  bass  . c2");
    expect(result.after).toContain("section drop   kick hat ride sub acid");
    expect(result.needsPreview).toBe(true);
    expect(proposal("rename x y", "x: kick x... // floor").after).toBe("y: kick x... // floor");
  });

  it("mute and unmute", () => {
    const muted = after("mute hat");
    expect(muted).toContain("| swing 0.12 | mute\n");
    expect(after("unmute hat", muted)).toBe(ONBOARD);
  });

  it("set writes numbers and signals with their range, keeping comments", () => {
    expect(after("set sub cutoff 220")).toContain("| cutoff 220\n");
    expect(after("set kick decay 0.5", "kick x... // floor")).toBe("kick x... | decay 0.5 // floor");
    expect(after("set bass cutoff sine(4) 200..900")).toContain("| cutoff sine(4) 200..900 | pan 0.2");
    expect(after("set kick reverb sea", "kick x...")).toBe("kick x... | reverb sea");
    expect(after("set kick free", "kick x...")).toBe("kick x... | free");
  });

  it("tone, steps and bars", () => {
    expect(after("tone kick 0.7", "kick x...")).toBe("kick x... | tone 0.7");
    expect(after("steps kick 16", "kick x... x...")).toBe("kick x... .... x... ....");
    expect(proposal("steps kick 8", "kick x... x... x... x...").needsPreview).toBe(true);
    expect(proposal("steps kick 32", "kick x... x... x... x...").needsPreview).toBe(false);
    expect(after("bars kick 2", "kick x...")).toBe("kick x... / x...");
    expect(proposal("bars kick 1", "kick x... / x.x.").needsPreview).toBe(true);
  });

  it("bars grows a written loop shorter than the pattern, in the same edit", () => {
    expect(after("bars kick 8", "loop 4\nkick x...")).toBe(`loop 8\nkick x...${" / x...".repeat(7)}`);
  });

  it("section creates or replaces, previewing a replacement", () => {
    const created = proposal("section outro kick sub");
    expect(created.after).toContain("section break  hat bass\nsection outro kick sub\n");
    expect(created.needsPreview).toBe(false);
    const replaced = proposal("section break hat");
    expect(replaced.after).toContain("section break  hat\n");
    expect(replaced.needsPreview).toBe(true);
  });

  it("song with commas replaces the parts, previewed", () => {
    const result = proposal("song intro 4, drop 8");
    expect(result.after).toContain("song intro 4, drop 8\n");
    expect(result.needsPreview).toBe(true);
    expect(after("song a 8", "kick x...\nsection a kick")).toBe("kick x...\nsection a kick\nsong a 8");
  });

  it("fix applies every safe quick fix in one edit", () => {
    const result = proposal("fix", "k: kik x...\nb: bass c2 | cutof 300 | gain 2.5");
    expect(result.after).toBe("k: kick x...\nb: bass c2 | cutoff 300 | gain 2");
    expect(result.summary).toBe("Fixed 3 problems.");
    expect(result.needsPreview).toBe(true);
    expect(run("fix", "bass: bass c2\nbass: bass c3")).toEqual({ kind: "info", lines: [{ text: "Nothing to fix: every error left needs a choice in the code." }] });
  });
});

describe("commands that go to the session", () => {
  it.each([
    ["play", { kind: "play" }],
    ["stop", { kind: "stop" }],
    ["drop", { kind: "drop" }],
    ["undo", { kind: "undo" }],
    ["redo", { kind: "redo" }],
    ["solo bass", { kind: "solo", track: "bass" }],
  ])("%s", (line, action) => {
    expect(run(line)).toEqual({ kind: "action", action });
  });

  it("clear and an empty line", () => {
    expect(run("clear")).toEqual({ kind: "clear" });
    expect(run("   ")).toEqual({ kind: "empty" });
  });
});

describe("reading the line", () => {
  it("accepts a capitalized command and extra blanks", () => {
    expect(after("Tempo   124")).toBe(ONBOARD.replace("tempo 132", "tempo 124"));
  });

  it("never evaluates: anything outside the list is an unknown command", () => {
    expect(run("eval(1)")).toEqual({ kind: "error", message: 'Unknown command "eval(1)".', suggestion: null });
    expect(run("constructor")).toEqual({ kind: "error", message: 'Unknown command "constructor".', suggestion: null });
  });

  it("refuses a value that would add another modifier", () => {
    expect(run("set kick decay 1 | mute", "kick x...").kind).toBe("error");
  });
});

describe("errors say why and suggest a line", () => {
  it.each([
    ["tmepo 124", 'Unknown command "tmepo".', "tempo 124"],
    ["mute kik", 'No track named "kik".', "mute kick"],
    ["add bas", 'No instrument named "bas".', "add bass"],
    ["set bass cutof 900", '"bass" has no parameter "cutof".', "set bass cutoff 900"],
    ["set kick cutof 300", '"kick" has no parameter "cutof". kick has decay, drive, pitch, click, sweep, sweep-time, overtone, click-tone, grit, level.', "set kick decay 0.45"],
    ["tempo 350", "tempo must be between 40 and 300.", "tempo 300"],
    ["tempo", "tempo needs a bpm, for example tempo 124.", "tempo 124"],
    ["loop 20", "loop must be a whole number from 1 to 16.", "loop 16"],
    ["key c minr", 'No scale named "minr".', "key c minor"],
    ["set bass cutoff 9000", "cutoff must be between 40 and 8000.", "set bass cutoff 8000"],
    ["set bass cutoff sine(8)", "sine(8) needs a range, for example 40..8000.", "set bass cutoff sine(8) 40..8000"],
    ["steps hat 12", "steps must be 8, 16, 32.", "steps hat 16"],
    ["section drop kick hta", 'No track named "hta".', "section drop kick hat"],
    ["song intro 8, dorp 16", 'No section named "dorp".', "song intro 8, drop 16"],
    ["explain bas", 'No track or section named "bas".', "explain bass"],
    ["help tmepo", 'Unknown command "tmepo".', "help tempo"],
    ["play now", "Too many words. Usage: play", null],
  ])("%s", (line, message, suggestion) => {
    expect(run(line)).toEqual({ kind: "error", message, suggestion });
  });

  it.each([
    ["gain kick 0.5", 'Unknown command "gain".', "set kick gain 0.5"],
    ["kick gain 0.5", 'Unknown command "kick".', "set kick gain 0.5"],
    ["cutoff bass sine(8) 300..900", 'Unknown command "cutoff".', "set bass cutoff sine(8) 300..900"],
    ["gian kick 0.5", 'Unknown command "gian".', null],
    ["kick 0.5", 'Unknown command "kick".', null],
  ])("a parameter or a track first reads as set: %s", (line, message, suggestion) => {
    expect(run(line)).toEqual({ kind: "error", message, suggestion });
  });

  it("names: invalid and taken", () => {
    expect(run("rename bass Acid")).toMatchObject({ kind: "error", message: '"Acid" can\'t be a name: start with a letter, then letters, digits, - or _.' });
    expect(run("rename bass kick")).toMatchObject({ kind: "error", message: 'A track named "kick" already exists.' });
    expect(run("add bass kick")).toMatchObject({ kind: "error", message: 'A track named "kick" already exists.' });
  });

  it("an edit the analysis refuses leaves the text alone", () => {
    expect(run("remove kick", "kick x...\nsection a kick")).toEqual({
      kind: "error",
      message: "That would leave a section with no tracks; change the section first.",
      suggestion: null,
    });
  });

  it("a command that changes nothing says so", () => {
    expect(run("tempo 132")).toEqual({ kind: "info", lines: [{ text: "Nothing to change: it is already so." }] });
  });
});

describe("help and explain", () => {
  it("help lists every command, help <cmd> details one", () => {
    const all = run("help");
    expect(all.kind === "info" && all.lines.length).toBe(COMMANDS.length + 1);
    expect(run("help tempo")).toEqual({
      kind: "info",
      lines: [{ text: "tempo <bpm>", code: true }, { text: "40 to 300" }, { text: "For example: tempo 124" }],
    });
  });

  it("explain is deterministic plain English from the program", () => {
    expect(run("explain bass")).toEqual({
      kind: "info",
      lines: [
        { text: "bass is a bass track (bass, pitched)." },
        { text: "Its pattern has 1 bar of 8 steps, with 4 notes in all." },
        { text: "Sound: cutoff moves with a sine over 8 bars, 300 to 1400 Hz; pan 0.2." },
        { text: "It plays in drop and break." },
      ],
    });
    expect(run("explain 2")).toEqual({ kind: "info", lines: [{ text: "Tempo 132: 132 beats per minute, so a bar of four beats lasts 1.82 seconds." }] });
    expect(run("explain 1")).toMatchObject({ kind: "info", lines: [{ text: "Line 1 is a comment: notes for people, it never sounds." }] });
    expect(run("explain drop")).toMatchObject({ kind: "info", lines: [{ text: "Section drop plays kick, hat, ride, sub and bass." }] });
    expect(run("explain 13")).toMatchObject({ kind: "info", lines: [{ text: expect.stringContaining("56 bars in all, then it stops.") }] });
    expect(run("explain 14")).toMatchObject({ kind: "info", lines: [{ text: "Line 14 is empty." }] });
    expect(run("explain 99")).toMatchObject({ kind: "error", suggestion: "explain 14" });
  });
});
