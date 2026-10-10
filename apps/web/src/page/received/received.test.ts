// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { AnalyzeResult } from "@untzel/language";
import type { CarriedRange, PlaybackMode, PlayRange, SessionView } from "@untzel/session";
import { describe, expect, it, vi } from "vitest";
import { announcements } from "../../strings/en";
import { AUTOSAVE_DELAY_MS, createAutosave } from "../autosave";
import { DeferredControlsPort, type StartSource, type TemplateChoice } from "../deferred-controls-port";
import { applyReceived } from "./received-source";

const valid = (): AnalyzeResult => ({ ok: true, program: { song: null, sections: [] } as never, warnings: [] });
/** A text with sections and a `song` line: the fallback opens it in song. */
const validSong = (): AnalyzeResult => ({ ok: true, program: { song: { parts: [], loop: false }, sections: [{}] } as never, warnings: [] });
const link = (source: string, mode: PlaybackMode | null = null, range: PlayRange | null = null) => ({ source, mode, range, origin: "link", formatVersion: null }) as const;
const file = (source: string, formatVersion: number | null = 1, mode: PlaybackMode | null = null) =>
  ({ source, mode, range: null, origin: "file", formatVersion }) as const;

/** The calls that change the session's text and mode. */
function fakeModeSession(calls: string[] = []) {
  return {
    applyText: () => calls.push("applyText"),
    setMode: (next: PlaybackMode) => {
      calls.push(`setMode ${next}`);
      return { ok: true } as const;
    },
  };
}
/** The play range's receiver, writing what it got into the same calls. */
function fakeRanges(calls: string[] = []) {
  return { receive: (carried: CarriedRange | null) => void calls.push(carried === null ? "range none" : `range ${carried.mode} ${carried.range.startBar}-${carried.range.endBar}`) };
}
const invalid = (): AnalyzeResult => ({
  ok: false,
  diagnostics: [{ code: "SYNTAX_ERROR", message: "Unexpected character", messageKey: "unexpected", messageArgs: ["!"], from: 0, to: 1, severity: "error" }],
});

function fakeSession() {
  const listeners = new Set<(view: SessionView) => void>();
  return {
    subscribe: (listener: (view: SessionView) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (source: string, isValid = true) => {
      for (const listener of listeners) listener({ source, valid: isValid } as SessionView);
    },
  };
}

function fakeTimers() {
  const pending: { run: () => void; at: number; cancelled: boolean }[] = [];
  let now = 0;
  return {
    setTimer: (run: () => void, ms: number) => {
      const entry = { run, at: now + ms, cancelled: false };
      pending.push(entry);
      return () => void (entry.cancelled = true);
    },
    advance: (ms: number) => {
      now += ms;
      for (const entry of pending.filter((item) => !item.cancelled && item.at <= now)) {
        entry.cancelled = true;
        entry.run();
      }
    },
  };
}

describe("autosave", () => {
  it("saves nothing while the text is the starting text, then 1 s after the first valid edit", () => {
    const session = fakeSession();
    const timers = fakeTimers();
    const saveLocal = vi.fn(() => true);
    createAutosave({ base: "tempo 132", session, store: { saveLocal }, setTimer: timers.setTimer });
    session.emit("tempo 132");
    timers.advance(5_000);
    expect(saveLocal).not.toHaveBeenCalled();
    session.emit("tempo 120");
    timers.advance(AUTOSAVE_DELAY_MS - 1);
    session.emit("tempo 120"); // the playhead moved: the same text does not restart the wait
    expect(saveLocal).not.toHaveBeenCalled();
    timers.advance(1);
    expect(saveLocal).toHaveBeenCalledWith("tempo 120");
  });

  it("does not save an invalid edit", () => {
    const session = fakeSession();
    const timers = fakeTimers();
    const saveLocal = vi.fn(() => true);
    createAutosave({ base: "a", session, store: { saveLocal }, setTimer: timers.setTimer });
    session.emit("b", false);
    timers.advance(5_000);
    expect(saveLocal).not.toHaveBeenCalled();
  });

  it("rebase changes the starting text and cancels the pending save", () => {
    const session = fakeSession();
    const timers = fakeTimers();
    const saveLocal = vi.fn(() => true);
    const autosave = createAutosave({ base: "a", session, store: { saveLocal }, setTimer: timers.setTimer });
    session.emit("b");
    autosave.rebase("c");
    timers.advance(5_000);
    session.emit("c");
    timers.advance(5_000);
    expect(saveLocal).not.toHaveBeenCalled();
    session.emit("d");
    timers.advance(AUTOSAVE_DELAY_MS);
    expect(saveLocal).toHaveBeenCalledWith("d");
  });

  it("after the first edit, an undo back to the starting text saves too", () => {
    const session = fakeSession();
    const timers = fakeTimers();
    const saveLocal = vi.fn(() => true);
    createAutosave({ base: "a", session, store: { saveLocal }, setTimer: timers.setTimer });
    session.emit("b");
    timers.advance(AUTOSAVE_DELAY_MS);
    expect(saveLocal).toHaveBeenLastCalledWith("b");
    session.emit("a");
    timers.advance(AUTOSAVE_DELAY_MS);
    expect(saveLocal).toHaveBeenLastCalledWith("a");
    expect(saveLocal).toHaveBeenCalledTimes(2);
  });

  it("flush saves the edit still waiting for its timer, once, and nothing when none waits", () => {
    const session = fakeSession();
    const timers = fakeTimers();
    const saveLocal = vi.fn(() => true);
    const autosave = createAutosave({ base: "a", session, store: { saveLocal }, setTimer: timers.setTimer });
    autosave.flush();
    expect(saveLocal).not.toHaveBeenCalled();
    session.emit("b");
    timers.advance(AUTOSAVE_DELAY_MS - 1);
    autosave.flush();
    expect(saveLocal).toHaveBeenCalledWith("b");
    timers.advance(5_000);
    autosave.flush();
    expect(saveLocal).toHaveBeenCalledTimes(1);
  });
});

describe("applyReceived", () => {
  const keep = (source: string): string => source;
  it("a link plays as a remix: the title is applied before the rebase", () => {
    const rebased: string[] = [];
    const applied: string[] = [];
    applyReceived(link("tempo 120", "loop"), "The shared music", {
      analyze: valid,
      session: { ...fakeModeSession(), applyText: (text: string) => void applied.push(text) },
      ranges: fakeRanges(),
      autosave: { rebase: (text: string) => void rebased.push(text) },
      retitle: (source, origin) => (origin === "link" ? `title "Remix of X"\n${source}` : source),
      announce: () => undefined,
    });
    expect(rebased).toEqual(['title "Remix of X"\ntempo 120']);
    expect(applied).toEqual(['title "Remix of X"\ntempo 120']);
  });
  it("changes nothing when the text does not analyze", () => {
    const applyText = vi.fn();
    const rebase = vi.fn();
    const said: string[] = [];
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const outcome = applyReceived(link("x", "song"), "The shared music", {
      analyze: invalid,
      session: { ...fakeModeSession(), applyText },
      ranges: fakeRanges(),
      autosave: { rebase }, retitle: keep,
      announce: (message) => said.push(message),
    });
    expect(outcome).toBe("rejected");
    expect(applyText).not.toHaveBeenCalled();
    expect(rebase).not.toHaveBeenCalled();
    expect(said).toEqual([announcements.linkFailed]);
    const fromFile: string[] = [];
    const dependencies = { analyze: invalid, session: { ...fakeModeSession(), applyText }, ranges: fakeRanges(), autosave: { rebase }, retitle: keep, announce: (m: string) => fromFile.push(m) };
    applyReceived(file("x", null), "song.untzel", dependencies);
    applyReceived(file("x", 2), "song.untzel", dependencies);
    expect(fromFile).toEqual([announcements.fileHasErrors("Unexpected character"), announcements.fileNeedsNewer]);
    info.mockRestore();
  });

  it("rebases before applying valid text, and announces it for the next bar", () => {
    const order: string[] = [];
    const said: string[] = [];
    const outcome = applyReceived(file("tempo 120"), "song.untzel", {
      analyze: valid,
      session: fakeModeSession(order),
      ranges: fakeRanges(order),
      autosave: { rebase: () => order.push("rebase") },
      retitle: keep,
      announce: (message) => said.push(message),
    });
    expect(outcome).toBe("applied");
    expect(order).toEqual(["rebase", "applyText", "setMode loop", "range none"]);
    expect(said).toEqual(["song.untzel plays on the next bar."]);
  });

  it("switches to the mode the link or file carries", () => {
    const calls: string[] = [];
    const announce = () => undefined;
    const rebase = () => undefined;
    applyReceived(link("tempo 120", "song"), "The shared music", { analyze: validSong, session: fakeModeSession(calls), ranges: fakeRanges(), autosave: { rebase }, retitle: keep, announce });
    expect(calls).toEqual(["applyText", "setMode song"]);
    calls.length = 0;
    applyReceived(file("tempo 120", 1, "loop"), "song.untzel", { analyze: validSong, session: fakeModeSession(calls), ranges: fakeRanges(), autosave: { rebase }, retitle: keep, announce });
    expect(calls).toEqual(["applyText", "setMode loop"]);
  });

  it("hands the carried range to its mode after the text and the mode", () => {
    const calls: string[] = [];
    const dependencies = { analyze: validSong, session: fakeModeSession(calls), ranges: fakeRanges(calls), autosave: { rebase: () => undefined }, retitle: keep, announce: () => undefined };
    applyReceived(link("tempo 120", "song", { startBar: 9, endBar: 28, cycle: false }), "The shared music", dependencies);
    expect(calls).toEqual(["applyText", "setMode song", "range song 9-28"]);
    calls.length = 0;
    // A link made before the range travelled: the range of the music that plays stays.
    applyReceived(link("tempo 120", "song"), "The shared music", dependencies);
    expect(calls).toEqual(["applyText", "setMode song", "range none"]);
  });
  it("without a carried mode: song when the text has a song line, else loop", () => {
    const calls: string[] = [];
    const announce = () => undefined;
    const rebase = () => undefined;
    applyReceived(link("tempo 120"), "The shared music", { analyze: validSong, session: fakeModeSession(calls), ranges: fakeRanges(), autosave: { rebase }, retitle: keep, announce });
    expect(calls).toEqual(["applyText", "setMode song"]);
    calls.length = 0;
    applyReceived(file("tempo 120", null), "song.untzel", { analyze: valid, session: fakeModeSession(calls), ranges: fakeRanges(), autosave: { rebase }, retitle: keep, announce });
    expect(calls).toEqual(["applyText", "setMode loop"]);
  });
});

describe("DeferredControlsPort", () => {
  function port() {
    const starts: StartSource[] = [];
    const choices: TemplateChoice[] = [];
    const asked: string[] = [];
    const record = (name: string) => (...args: unknown[]) => void asked.push([name, ...args].join(" "));
    const projects = {
      newProject: record("new"),
      openProject: record("open"),
      continueProject: (id: string) => void starts.push({ kind: "project", id }),
      renameSong: record("renameSong"),
      renameProject: record("renameProject"),
      duplicateProject: record("duplicate"),
      deleteProject: record("delete"),
      undoDeleteProject: record("undo"),
      saveProjectFile: record("saveFile"),
      saveProjectNow: record("saveNow"),
    };
    const deferred = new DeferredControlsPort({
      phase: "idle",
      templates: { blank: null, styles: [{ id: "house", label: "House" }], projects: [{ id: "onboard", style: "house", name: "Onboard", summary: null }] },
      choice: { template: "onboard", openStyle: null },
      actions: { start: (source) => starts.push(source), retry: () => undefined, openFile: () => undefined, projects, saveWaitingFile: record("saveWaiting") },
      onTemplateChoice: (choice) => choices.push(choice),
      frames: { request: () => 0, cancel: () => undefined },
    });
    return { deferred, starts, choices, asked };
  }

  it("plays received text on the tap, under the Remix this notice", () => {
    const { deferred, starts } = port();
    deferred.receive({ source: "tempo 120", origin: "link", mode: "loop", range: null });
    expect(deferred.view().templates.notice).toEqual({ kind: "remix", from: "link" });
    deferred.start("onboard");
    expect(starts).toEqual([{ kind: "text", source: "tempo 120", origin: "link", mode: "loop", range: null }]);
  });

  it("leaves the link behind when a template is chosen", () => {
    const { deferred, starts } = port();
    deferred.receive({ source: "tempo 120", origin: "link", mode: null, range: null });
    deferred.selectTemplate("blank");
    expect(deferred.view().templates.notice).toBeNull();
    deferred.start("blank");
    expect(starts).toEqual([{ kind: "template", name: "blank" }]);
  });

  it("Continue plays the stored project inside the tap; the menu's intents reach the library", () => {
    const { deferred, starts, asked } = port();
    deferred.continueProject("p1");
    expect(starts).toEqual([{ kind: "project", id: "p1" }]);
    deferred.renameSong("Night");
    deferred.saveFile();
    expect(asked).toEqual(["renameSong Night", "saveWaiting"]);
  });
  it("after the menu switched project, the tap plays that project; the view carries the project", () => {
    const { deferred, starts } = port();
    deferred.waitForTap("p2");
    deferred.start("onboard");
    expect(starts).toEqual([{ kind: "project", id: "p2" }]);
    deferred.setProject({ title: "Night", saveState: "saved", fileName: "night.untzel", isStorageBlocked: false, projects: [], latest: null });
    expect(deferred.view().project.title).toBe("Night");
  });

  it("a failure notice keeps what was received", () => {
    const { deferred, starts } = port();
    deferred.receive({ source: "tempo 120", origin: "file", mode: null, range: null });
    deferred.notice({ kind: "failed", message: "This file is not an Untzel song." });
    expect(deferred.view().templates.notice).toEqual({ kind: "failed", message: "This file is not an Untzel song." });
    deferred.start("onboard");
    expect(starts).toEqual([{ kind: "text", source: "tempo 120", origin: "file", mode: null, range: null }]);
  });

  it("hands each template and style tab chosen to be remembered", () => {
    const { deferred, choices } = port();
    deferred.openTemplateStyle("psytrance");
    deferred.selectTemplate("blank");
    expect(choices).toEqual([
      { template: "onboard", openStyle: "psytrance" },
      { template: "blank", openStyle: "psytrance" },
    ]);
    expect(deferred.view().templates).toMatchObject({ selected: "blank", openStyle: "psytrance" });
  });

  it("shows the tempo and key once the engine's code describes the library", () => {
    const { deferred } = port();
    const described = { blank: null, styles: [{ id: "house", label: "House" }], projects: [{ id: "onboard", style: "house", name: "Onboard", summary: { bpm: 124, key: { tonic: 9, scale: "minor" as const } } }] };
    deferred.describeTemplates(described);
    expect(deferred.view().templates.catalog).toBe(described);
  });
});
