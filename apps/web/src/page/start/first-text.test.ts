// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { AnalyzeResult } from "@untzel/language";
import type { ProjectRecord } from "@untzel/session/projects";
import { describe, expect, it, vi } from "vitest";
import { announcements } from "../../strings/en";
import { firstTextOf, type FirstTextSources } from "./first-text";

const valid = (): AnalyzeResult => ({ ok: true, program: { song: null, sections: [] } as never, warnings: [] });
/** Sections and a `song` line. */
const validSong = (): AnalyzeResult => ({ ok: true, program: { song: { parts: [], loop: false }, sections: [{}] } as never, warnings: [] });
const invalid = (): AnalyzeResult => ({
  ok: false,
  diagnostics: [{ code: "SYNTAX_ERROR", message: "Unexpected character", messageKey: "unexpected", messageArgs: ["!"], from: 0, to: 1, severity: "error" }],
});
const stored: ProjectRecord = { id: "p1", source: 'title "Night"\nkick x...', title: "Night", createdAt: "", updatedAt: "", templateOrigin: "house/sunday-piano" };
function sources(analyze: () => AnalyzeResult = valid): FirstTextSources {
  return {
    analyze,
    template: async (name) => `template ${name}`,
    fallback: "melodic-techno/midnight-bloom",
    project: async (id) => (id === "p1" ? stored : null),
    untitled: (source) => `untitled|${source}`,
    remix: (source) => `remix|${source}`,
  };
}

describe("firstTextOf", () => {
  it("a template plays in loop, as a new project of that template, with a title line", async () => {
    expect(await firstTextOf({ kind: "template", name: "garden" }, sources())).toEqual({
      source: "untitled|template garden",
      mode: "loop",
      range: null,
      notice: null,
      project: { id: null, templateOrigin: "garden" },
    });
  });
  it("a stored project plays in the session's default mode and stays that project", async () => {
    expect(await firstTextOf({ kind: "project", id: "p1" }, sources())).toEqual({
      source: stored.source,
      mode: null,
      range: null,
      notice: null,
      project: { id: "p1", templateOrigin: "house/sunday-piano" },
    });
  });
  it("a project plays in the mode and range it was left in", async () => {
    const playback = { mode: "song", range: { startBar: 9, endBar: 28, cycle: false } } as const;
    const project = async (id: string) => (id === "p1" ? { ...stored, playback } : null);
    expect(await firstTextOf({ kind: "project", id: "p1" }, { ...sources(validSong), project })).toMatchObject({ mode: "song", range: playback });
    // Song mode needs sections: the text opens in loop, and the range waits in the song's ruler.
    expect(await firstTextOf({ kind: "project", id: "p1" }, { ...sources(valid), project })).toMatchObject({ mode: "loop", range: playback });
  });
  it("a project that is gone falls back to the first-touch template, with a notice", async () => {
    const first = await firstTextOf({ kind: "project", id: "gone" }, sources());
    expect(first).toMatchObject({ source: "template melodic-techno/midnight-bloom", mode: "loop", notice: announcements.savedFailed });
  });
  it("a link becomes a remix, a new project; a file keeps its own title", async () => {
    const link = { kind: "text", source: "tempo 120\n", origin: "link", mode: "loop", range: null } as const;
    expect(await firstTextOf(link, sources(validSong))).toEqual({ source: "remix|tempo 120\n", mode: "loop", range: null, notice: null, project: { id: null, templateOrigin: null } });
    const range = { startBar: 2, endBar: 3, cycle: true };
    const file = { kind: "text", source: "tempo 120\n", origin: "file", mode: "song", range } as const;
    expect(await firstTextOf(file, sources(validSong))).toMatchObject({ source: "tempo 120\n", mode: "song", range: { mode: "song", range } });
  });
  it("received text without a mode: song with a song line, else loop", async () => {
    const start = { kind: "text", source: "tempo 120\n", origin: "link", mode: null, range: null } as const;
    expect((await firstTextOf(start, sources(validSong))).mode).toBe("song");
    expect((await firstTextOf(start, sources(valid))).mode).toBe("loop");
  });
  it("text that does not analyze falls back to the first-touch template in loop, with a notice", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const link = await firstTextOf({ kind: "text", source: "x", origin: "link", mode: "song", range: null }, sources(invalid));
    expect([link.source, link.mode, typeof link.notice]).toEqual(["template melodic-techno/midnight-bloom", "loop", "string"]);
  });
});
