// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Never lose the open session: an edit younger than the autosave's 1 s is saved
// into the project it was made in when another project, a file or a link takes its place,
// and a save that finishes after the switch never marks the old project as open again.
import type { Session, SessionView, TitleEdits } from "@untzel/session";
import type { ProjectPlayback } from "@untzel/session/projects";
import { MemoryProjectStore } from "@untzel/session/testing";
import { describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, createAutosave } from "../page/autosave";
import { ProjectControls } from "./project-controls";
import { createProjectLibrary } from "./project-library";

const FIRST = 'title "Harbour"\ntempo 120\nkick x...';
const RENAMED = 'title "Harbour Lights"\ntempo 120\nkick x...';

/** A session whose text the test sets, as an edit would. */
function fakeSession(source: string) {
  const listeners = new Set<(view: SessionView) => void>();
  let view = { source, valid: true, title: null } as unknown as SessionView;
  const session = {
    view: () => view,
    subscribe: (listener: (next: SessionView) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const edit = (next: string): void => {
    view = { ...view, source: next };
    for (const listener of listeners) listener(view);
  };
  return { session, edit };
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

/** Lets the library's promises settle. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The page as boot wires it: the autosave writes through persist; leaving disposes it. */
async function setup(stored: boolean) {
  const store = new MemoryProjectStore();
  const library = createProjectLibrary(store);
  const first = stored ? await library.create(FIRST, null) : null;
  /** What plays now: the test changes it as a gesture on the transport would. */
  const playback: { current: ProjectPlayback | null } = { current: null };
  const timers = fakeTimers();
  const { session, edit } = fakeSession(FIRST);
  const waits: unknown[] = [];
  let autosave: ReturnType<typeof createAutosave> | null = null;
  const controls = new ProjectControls({
    library: Promise.resolve(library),
    page: {
      waitForTap: (start) => {
        waits.push(start);
        autosave?.dispose();
      },
      start: () => undefined,
    },
    describe: () => null,
    saveFile: () => undefined,
    now: () => new Date("2026-10-04T12:00:00.000Z"),
  });
  autosave = createAutosave({
    base: FIRST,
    session,
    store: { saveLocal: (source) => (void controls.persist(source), true) },
    setTimer: timers.setTimer,
  });
  const opened = { session: session as unknown as Session, titles: {} as TitleEdits, savePending: () => autosave?.flush(), playback: () => playback.current };
  controls.open(opened, first?.id ?? null, null, FIRST);
  await settle();
  return { store, controls, edit, timers, waits, playback, firstId: first?.id ?? "", rebase: (text: string) => autosave?.rebase(text) };
}

describe("ProjectControls: the last edit before a switch", () => {
  it("New project… half a second after a rename saves the rename into the open project", async () => {
    const { store, controls, edit, timers, waits, firstId } = await setup(true);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS / 2);
    controls.newProject();
    await settle();
    timers.advance(AUTOSAVE_DELAY_MS * 5);
    await settle();
    expect(waits).toEqual([null]);
    expect([...store.records.values()].map((record) => [record.id, record.title, record.source])).toEqual([[firstId, "Harbour Lights", RENAMED]]);
    expect(controls.view().projects.map((project) => project.isOpen)).toEqual([false]);
  });

  it("an unsaved song edited just before Open project… becomes a project, which is not marked open", async () => {
    const { store, controls, edit, timers } = await setup(false);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS - 1);
    controls.openProject("another");
    await settle();
    expect([...store.records.values()].map((record) => record.source)).toEqual([RENAMED]);
    expect(controls.view().projects.map((project) => project.isOpen)).toEqual([false]);
  });

  it("a received file or link keeps the edit in the old project, then saves as a new one", async () => {
    const { store, controls, edit, timers, firstId, rebase } = await setup(true);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS / 2);
    const received = 'title "Remix of Harbour"\ntempo 140\nkick x...';
    controls.detach(received);
    rebase(received);
    await settle();
    edit(received.replace("tempo 140", "tempo 141"));
    timers.advance(AUTOSAVE_DELAY_MS);
    await settle();
    expect(store.records.get(firstId)?.source).toBe(RENAMED);
    expect(store.records.size).toBe(2);
  });

  it("Delete project with an edit still waiting: Undo brings the project back with the edit", async () => {
    const { store, controls, edit, timers, waits, firstId } = await setup(true);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS / 2);
    controls.deleteProject(firstId);
    await settle();
    expect(store.records.size).toBe(0);
    expect(waits).toEqual([null]);
    controls.undoDeleteProject();
    await settle();
    expect(store.records.get(firstId)?.source).toBe(RENAMED);
  });

  it("deleting an unsaved song never stores it on the way out", async () => {
    const { store, controls, edit, timers } = await setup(false);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS / 2);
    controls.deleteProject(null);
    await settle();
    timers.advance(AUTOSAVE_DELAY_MS * 5);
    await settle();
    expect(store.records.size).toBe(0);
  });
});
describe("ProjectControls: the mode and play range", () => {
  const SONG_RANGE: ProjectPlayback = { mode: "song", range: { startBar: 9, endBar: 28, cycle: false } };
  it("a stored project keeps a new range without a text save, and its place in the list", async () => {
    const { store, controls, playback, firstId } = await setup(true);
    const before = store.records.get(firstId);
    playback.current = SONG_RANGE;
    controls.playbackChanged();
    await settle();
    expect(store.records.get(firstId)).toEqual({ ...before, playback: SONG_RANGE });
  });
  it("a project not stored yet takes the range at its first save, and an unchanged range writes nothing", async () => {
    const { store, controls, edit, timers, playback } = await setup(false);
    playback.current = SONG_RANGE;
    controls.playbackChanged();
    await settle();
    expect(store.records.size).toBe(0);
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS);
    await settle();
    const [saved] = [...store.records.values()];
    expect(saved).toMatchObject({ source: RENAMED, playback: SONG_RANGE });
    const put = vi.spyOn(store, "put");
    controls.playbackChanged();
    await settle();
    expect(put).not.toHaveBeenCalled();
  });
  it("a text save after a range change keeps both", async () => {
    const { store, controls, edit, timers, playback, firstId } = await setup(true);
    playback.current = SONG_RANGE;
    controls.playbackChanged();
    edit(RENAMED);
    timers.advance(AUTOSAVE_DELAY_MS);
    await settle();
    expect(store.records.get(firstId)).toMatchObject({ source: RENAMED, playback: SONG_RANGE });
  });
});
