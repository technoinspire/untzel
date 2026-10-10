// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library on the page: what the menu, the title in
// the bar and the Projects sheet ask for, over the session's ProjectLibrary. Switching
// project stops the music cleanly and waits for Tap to play; a rename is one edit of the
// title line through TitleEdits. Storage refused (private mode, full disk) only loses the
// list: the open session is never lost, and neither is an edit younger than the autosave's
// 1 s, which saves into the project it was made in before another one opens. The mode and
// play range go with the text; changing only them rewrites only them.
// Over 300 lines: the project intents of the menu, the title and the Projects sheet; they share the open project and its write queue.
import { copyTitle, liveStrings as strings } from "@untzel/skin";
import type { ProjectIntents } from "@untzel/skin-contract";
import type { Session, TitleEdits } from "@untzel/session";
import type { ProjectLibrary, ProjectPlayback, ProjectRecord } from "@untzel/session/projects";
import type { StartSource } from "../page/waiting/waiting-stage";
import { ProjectPlaybackWriter } from "./project-playback";
import { projectFileName, projectView } from "./project-view";
import type { ProjectView, SaveState } from "@untzel/presentation/view-model";

/** What the controller asks of the page. */
export interface ProjectPage {
  /** Stops the music cleanly and shows the waiting screen; the tap plays `start` (null: the templates). */
  waitForTap(start: StartSource | null): void;
  /** "Continue <title>": the tap itself, inside the gesture. */
  start(start: StartSource): void;
}

export interface ProjectControlsOptions {
  /** Null when this browser refuses storage: the list is empty and saving is blocked. */
  readonly library: Promise<ProjectLibrary | null>;
  readonly page: ProjectPage;
  readonly describe: (source: string) => string | null;
  /** Downloads or saves a stored project's .untzel, with its mode and range, under this name. */
  readonly saveFile: (name: string, record: ProjectRecord) => void;
  readonly now: () => Date;
}

interface Opened {
  readonly session: Session;
  readonly titles: TitleEdits;
  /** Saves the edit still waiting for the autosave's timer, now (Autosave.flush). */
  readonly savePending: () => void;
  /** The mode and range playing now; null before the first play. */
  readonly playback: () => ProjectPlayback | null;
}

export class ProjectControls implements ProjectIntents {
  readonly #options: ProjectControlsOptions;
  readonly #listeners = new Set<() => void>();
  readonly #details = new Map<string, { readonly at: string; readonly detail: string | null }>();
  #library: ProjectLibrary | null = null;
  #records: readonly ProjectRecord[] = [];
  #openId: string | null = null;
  #waitingId: string | null = null;
  #templateOrigin: string | null = null;
  #opened: Opened | null = null;
  #lastSaved: string | null = null;
  /** The text the open project started from: nothing to save until it changes. */
  #base: string | null = null;
  #deleted: { readonly record: ProjectRecord; readonly wasOpen: boolean } | null = null;
  #isBlocked = false;
  /** Changes whenever another project opens: a save that finishes later never claims it. */
  #opening = 0;
  /** The last write in flight, so Delete removes after it. */
  #saving: Promise<unknown> = Promise.resolve();
  readonly #playback = new ProjectPlaybackWriter();
  /** The title and save state last told, so the playhead's moves tell nothing. */
  #shown = "";

  constructor(options: ProjectControlsOptions) {
    this.#options = options;
    void options.library.then((library) => {
      this.#library = library;
      this.#isBlocked = library === null;
      return this.#refresh();
    });
  }

  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get(id: string): Promise<ProjectRecord | null> {
    return this.#library?.get(id) ?? Promise.resolve(null);
  }

  view(): ProjectView {
    return projectView({
      records: this.#records,
      title: this.#title(),
      openId: this.#openId ?? this.#waitingId,
      saveState: this.#saveState(),
      isStorageBlocked: this.#isBlocked,
      detailOf: (record) => this.#detail(record),
      now: this.#options.now(),
    });
  }

  /** The session plays this project now; `id` null is a new one, created at its first save. */
  open(opened: Opened, id: string | null, templateOrigin: string | null, base: string): void {
    this.#opening += 1;
    this.#opened = opened;
    this.#openId = id;
    this.#waitingId = null;
    this.#templateOrigin = templateOrigin;
    this.#lastSaved = id === null ? null : base;
    this.#base = base;
    this.#playback.remember(opened.playback());
    this.#emit();
  }

  /** Text that came from outside (a link, a file) while playing: a new project, never an overwrite. */
  detach(base: string): void {
    this.#opened?.savePending();
    this.#opening += 1;
    this.#openId = null;
    this.#templateOrigin = null;
    this.#lastSaved = null;
    this.#base = base;
    this.#emit();
  }

  /** The autosave's write: the open project, created at its first save. */
  persist(source: string): Promise<boolean> {
    const saving = this.#write(source);
    this.#saving = saving;
    return saving;
  }

  async #write(source: string): Promise<boolean> {
    const library = this.#library;
    if (library === null) return false;
    const opening = this.#opening;
    // The project open now and what plays in it, read before the first await: they may change while this saves.
    const id = this.#openId;
    const playback = this.#opened?.playback() ?? null;
    this.#playback.remember(playback);
    try {
      await this.#playback.writing;
      const record = id === null ? await library.create(source, this.#templateOrigin, playback) : await library.save(id, source, playback);
      if (opening === this.#opening) {
        this.#openId = record.id;
        this.#lastSaved = source;
      }
      await this.#refresh();
      return true;
    } catch (error) {
      console.warn("projects: the project was not saved on this device", error);
      this.#isBlocked = true;
      this.#emit();
      return false;
    }
  }

  /** The session changed: the bar's title and Saving… follow it; the playhead alone changes nothing. */
  sessionChanged(): void {
    const shown = `${this.#title() ?? ""}|${this.#saveState() ?? ""}`;
    if (shown === this.#shown) return;
    this.#emit();
  }

  /**
   * The mode or the range may have changed: a stored project keeps them without a text save.
   * A project not stored yet takes them at its first save.
   */
  playbackChanged(): void {
    const library = this.#library;
    const id = this.#openId;
    const playback = this.#opened?.playback() ?? null;
    if (library === null || id === null || playback === null) return;
    this.#playback.write(library, id, playback, this.#saving);
  }

  newProject(): void {
    this.#leave(null);
  }

  openProject(id: string): void {
    this.#leave(id);
  }

  continueProject(id: string): void {
    this.#waitingId = id;
    this.#options.page.start({ kind: "project", id });
  }

  renameSong(title: string): void {
    if (this.#opened !== null) {
      this.#opened.titles.setTitle(title);
      return;
    }
    if (this.#waitingId !== null) this.renameProject(this.#waitingId, title);
  }

  renameProject(id: string, title: string): void {
    if (this.#opened !== null && id === this.#openId) return this.renameSong(title);
    void this.#library?.rename(id, title).then(() => this.#refresh());
  }

  duplicateProject(id: string | null): void {
    void this.#sourceOf(id).then(async (found) => {
      const library = this.#library;
      if (found === null || library === null) return;
      const copy = await library.duplicate(found.source, copyTitle(found.title ?? strings.untitled), found.templateOrigin, found.playback ?? null);
      await this.#refresh();
      this.#leave(copy.id);
    });
  }

  deleteProject(id: string | null): void {
    const target = id ?? this.#openId ?? this.#waitingId;
    const wasOpen = target === null || target === this.#openId || target === this.#waitingId;
    // A stored project's last edit is stored first, so Undo brings it back with it; an
    // unsaved one is only dropped, never created on its way out.
    if (wasOpen && target !== null) this.#opened?.savePending();
    void this.#sourceOf(target).then(async (found) => {
      if (found === null) return;
      await this.#saving;
      const removed = target === null || this.#library === null ? null : await this.#library.remove(target);
      this.#deleted = { record: removed ?? found, wasOpen };
      await this.#refresh();
      if (wasOpen) this.#close(null);
    });
  }

  undoDeleteProject(): void {
    const deleted = this.#deleted;
    const library = this.#library;
    this.#deleted = null;
    if (deleted === null || library === null) return;
    void library.restore(deleted.record).then(async () => {
      await this.#refresh();
      if (deleted.wasOpen) this.#leave(deleted.record.id);
    });
  }

  saveProjectFile(id: string): void {
    void this.#library?.get(id).then((record) => {
      if (record !== null) this.#options.saveFile(projectFileName(record.title, this.#options.now()), record);
    });
  }

  saveProjectNow(): void {
    const view = this.#opened?.session.view();
    if (view !== undefined && view.valid) void this.persist(view.source);
  }

  /** Saves the open project's last edit into it, then closes it for `id`. */
  #leave(id: string | null): void {
    this.#opened?.savePending();
    this.#close(id);
  }

  /** Stops the music and waits on the waiting screen: the project `id`, or the templates. */
  #close(id: string | null): void {
    this.#opening += 1;
    this.#opened = null;
    this.#openId = null;
    this.#waitingId = id;
    this.#lastSaved = null;
    this.#options.page.waitForTap(id === null ? null : { kind: "project", id });
    this.#emit();
  }

  /** The open text as a record (stored or not), or a stored one by id. */
  async #sourceOf(id: string | null): Promise<ProjectRecord | null> {
    if (id !== null && id !== this.#openId) return (await this.#library?.get(id)) ?? null;
    const view = this.#opened?.session.view();
    if (view === undefined) return id === null ? null : ((await this.#library?.get(id)) ?? null);
    const at = this.#options.now().toISOString();
    const record = { id: id ?? `unsaved-${at}`, source: view.source, title: view.title, createdAt: at, updatedAt: at, templateOrigin: this.#templateOrigin };
    const playback = this.#opened?.playback() ?? null;
    return playback === null ? record : { ...record, playback };
  }

  #title(): string | null {
    if (this.#opened !== null) return this.#opened.session.view().title ?? strings.untitled;
    if (this.#waitingId === null) return null;
    return this.#records.find((record) => record.id === this.#waitingId)?.title ?? strings.untitled;
  }

  #saveState(): SaveState | null {
    if (this.#isBlocked) return "blocked";
    const view = this.#opened?.session.view();
    if (view === undefined) return this.#waitingId === null ? null : "saved";
    const saved = this.#lastSaved ?? this.#base;
    const isPending = view.valid && view.source !== saved;
    if (isPending) return "saving";
    return this.#lastSaved === null ? null : "saved";
  }

  #detail(record: ProjectRecord): string | null {
    const cached = this.#details.get(record.id);
    if (cached?.at === record.updatedAt) return cached.detail;
    const detail = this.#options.describe(record.source);
    this.#details.set(record.id, { at: record.updatedAt, detail });
    return detail;
  }

  async #refresh(): Promise<void> {
    try {
      this.#records = (await this.#library?.list()) ?? [];
    } catch {
      this.#records = [];
      this.#isBlocked = true;
    }
    this.#emit();
  }

  #emit(): void {
    this.#shown = `${this.#title() ?? ""}|${this.#saveState() ?? ""}`;
    for (const listener of this.#listeners) listener();
  }
}
