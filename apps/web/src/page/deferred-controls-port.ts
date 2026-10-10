// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The controls' port from the first paint. Until the engine runs it answers with the
// waiting stage (waiting-stage.ts); then `controls` forwards every intent to the running
// port, one forwarding module per group of intents (forwarding/). This class keeps the
// page's state and the intents that depend on it. Part of the initial JS, so it imports
// types and the shell's own constants only.

import type { ControlsPort, ProjectIntents, SessionIntents, ShareIntents, ViewSource } from "@untzel/skin-contract";
import type { Unsubscribe } from "@untzel/session";
import type { RunningControls } from "../adapters/session-controls-port";
import type { AppPhase, ProjectView, ReceivedNotice, TemplateCatalogView, UntzelView } from "@untzel/presentation/view-model";
import { NO_PROJECT } from "@untzel/presentation/view-model";
import { FrameCoalescer, type FrameScheduler } from "./frame-coalescer";
import { forwardAudition } from "./forwarding/audition";
import { forwardExporter } from "./forwarding/exporter";
import { forwardLibrary } from "./forwarding/library";
import { forwardPatterns } from "./forwarding/patterns";
import { forwardPlayback } from "./forwarding/playback";
import { forwardRange } from "./forwarding/range";
import { forwardShare } from "./forwarding/share";
import { forwardSong } from "./forwarding/song";
import { forwardSound } from "./forwarding/sound";
import { forwardStatements } from "./forwarding/statements";
import { forwardTracks } from "./forwarding/tracks";
import { WaitingStage, type ReceivedText, type StartSource, type TemplateChoice } from "./waiting/waiting-stage";

export type { StartSource, TemplateChoice } from "./waiting/waiting-stage";

type Listener<T> = (value: T) => void;

/** The intents that read the page's state: the waiting stage, the phase, the project. */
type PageIntents = ViewSource & ProjectIntents & Pick<SessionIntents, "start" | "selectTemplate" | "openTemplateStyle" | "retry"> & Pick<ShareIntents, "saveFile" | "openFile">;

export interface PageActions {
  /** Called inside the gesture: unlock audio before anything else. */
  start(source: StartSource): void;
  retry(): void;
  /** A file picked or dropped on the waiting stage: read and checked by the page. */
  openFile(file: File): void;
  /** The project library, there before the first tap. */
  readonly projects: ProjectIntents;
  /** Save file with no music running: the project waiting for the tap. */
  saveWaitingFile(): void;
}

export interface DeferredOptions {
  readonly phase: AppPhase;
  readonly templates: TemplateCatalogView;
  /** The template and the style tab the picker opens on. */
  readonly choice: TemplateChoice;
  readonly actions: PageActions;
  /** Each change of template or style tab, to remember it (TemplateChoiceStore). */
  readonly onTemplateChoice?: (choice: TemplateChoice) => void;
  /** The running music's changes are drawn once per frame. */
  readonly frames: FrameScheduler;
}

export class DeferredControlsPort {
  /** What the shell drives: the forwarders, then the page's intents (its saveFile and openFile win). */
  readonly controls: ControlsPort;
  readonly #waiting: WaitingStage;
  readonly #actions: PageActions;
  readonly #onTemplateChoice: (choice: TemplateChoice) => void;
  readonly #viewListeners = new Set<Listener<UntzelView>>();
  readonly #announcementListeners = new Set<Listener<string>>();
  readonly #frame: FrameCoalescer;
  #phase: AppPhase;
  #running: RunningControls | null = null;
  #project: ProjectView = NO_PROJECT;
  #detach: Unsubscribe[] = [];

  constructor(options: DeferredOptions) {
    this.#phase = options.phase;
    this.#waiting = new WaitingStage({ catalog: options.templates, choice: options.choice });
    this.#actions = options.actions;
    this.#onTemplateChoice = options.onTemplateChoice ?? (() => undefined);
    this.#frame = new FrameCoalescer(options.frames);
    const running = (): RunningControls | null => this.#running;
    this.controls = {
      ...forwardPlayback(running),
      ...forwardTracks(running),
      ...forwardAudition(running),
      ...forwardLibrary(running),
      ...forwardSound(running),
      ...forwardSong(running),
      ...forwardRange(running),
      ...forwardStatements(running),
      ...forwardPatterns(running),
      ...forwardShare(running),
      ...forwardExporter(running),
      ...this.#pageIntents(),
    };
  }

  get phase(): AppPhase {
    return this.#phase;
  }

  setPhase(phase: AppPhase): void {
    if (phase === this.#phase) return;
    this.#phase = phase;
    this.#emit();
  }

  attach(running: RunningControls): void {
    if (this.#running === running) return;
    this.detach();
    this.#running = running;
    this.#detach = [
      running.view.onChange(() => this.#frame.schedule(() => this.#emit())),
      running.view.onAnnouncement((message) => this.announce(message)),
    ];
    this.#emit();
  }

  detach(): void {
    for (const unsubscribe of this.#detach) unsubscribe();
    this.#detach = [];
    this.#frame.cancel();
    this.#running = null;
  }

  announce(message: string): void {
    for (const listener of this.#announcementListeners) listener(message);
  }

  /** Text that analyzed on the waiting stage: the next tap plays it, under "Remix this". */
  receive(received: ReceivedText): void {
    this.notice(this.#waiting.receive(received));
  }

  /** The project's part of the view, from the library. */
  setProject(project: ProjectView): void {
    this.#project = project;
    this.#emit();
  }
  /** The music stopped for another project: the waiting screen, and what the next tap plays. */
  waitForTap(project: string | null): void {
    this.#waiting.openProject(project);
    this.setPhase("idle");
    this.#emit();
  }
  /** The library again, with the tempo and key the engine's code read from each template. */
  describeTemplates(templates: TemplateCatalogView): void {
    this.#waiting.setCatalog(templates);
    this.#emit();
  }

  /** A failure notice leaves what was received before in place. */
  notice(notice: ReceivedNotice | null): void {
    this.#waiting.setNotice(notice);
    if (notice?.kind === "failed") this.announce(notice.message);
    this.#emit();
  }

  get isRunning(): boolean {
    return this.#running !== null && this.#phase === "running";
  }

  /** The running controls, for what the page routes to them (a link while playing). */
  get running(): RunningControls | null {
    return this.#running;
  }

  // ------------------------------------------------------------- view source

  view(): UntzelView {
    const running = this.#running;
    if (running === null || this.#phase !== "running") return { ...this.#waiting.view(this.#phase), project: this.#project };
    return { ...running.view.view(), phase: this.#phase, project: this.#project };
  }

  subscribe(listener: Listener<UntzelView>): Unsubscribe {
    this.#viewListeners.add(listener);
    return () => this.#viewListeners.delete(listener);
  }

  onAnnouncement(listener: Listener<string>): Unsubscribe {
    this.#announcementListeners.add(listener);
    return () => this.#announcementListeners.delete(listener);
  }

  // ------------------------------------------------------------ session intents

  /** The tap on the stage: what was received, else the selected template. */
  start(template: string): void {
    this.#actions.start(this.#waiting.tap(template));
  }

  /** Choosing a template leaves a received link behind: the next tap plays the template. */
  selectTemplate(template: string): void {
    this.#waiting.selectTemplate(template);
    this.#onTemplateChoice(this.#waiting.choice);
    this.#emit();
  }

  openTemplateStyle(style: string): void {
    this.#waiting.openTemplateStyle(style);
    this.#onTemplateChoice(this.#waiting.choice);
    this.#emit();
  }

  // ------------------------------------------------------------- projects
  newProject(): void {
    this.#actions.projects.newProject();
  }
  openProject(id: string): void {
    this.#actions.projects.openProject(id);
  }
  continueProject(id: string): void {
    this.#actions.projects.continueProject(id);
  }
  renameSong(title: string): void {
    this.#actions.projects.renameSong(title);
  }
  renameProject(id: string, title: string): void {
    this.#actions.projects.renameProject(id, title);
  }
  duplicateProject(id: string | null): void {
    this.#actions.projects.duplicateProject(id);
  }
  deleteProject(id: string | null): void {
    this.#actions.projects.deleteProject(id);
  }
  undoDeleteProject(): void {
    this.#actions.projects.undoDeleteProject();
  }
  saveProjectFile(id: string): void {
    this.#actions.projects.saveProjectFile(id);
  }
  saveProjectNow(): void {
    this.#actions.projects.saveProjectNow();
  }

  retry(): void {
    this.#actions.retry();
  }

  saveFile(): void {
    if (this.isRunning) this.#running?.share.saveFile();
    else this.#actions.saveWaitingFile();
  }

  /** Before the tap the page reads the file; once running the share controls do. */
  openFile(file: File): void {
    if (this.isRunning) this.#running?.share.openFile(file);
    else this.#actions.openFile(file);
  }

  /** Before an input: the views it reaches draw the music's newest state first. */
  drawPending(): void {
    this.#frame.flush();
  }

  #pageIntents(): PageIntents {
    return {
      view: () => this.view(),
      subscribe: (listener) => this.subscribe(listener),
      onAnnouncement: (listener) => this.onAnnouncement(listener),
      start: (template) => this.start(template),
      selectTemplate: (template) => this.selectTemplate(template),
      openTemplateStyle: (style) => this.openTemplateStyle(style),
      retry: () => this.retry(),
      newProject: () => this.newProject(),
      openProject: (id) => this.openProject(id),
      continueProject: (id) => this.continueProject(id),
      renameSong: (title) => this.renameSong(title),
      renameProject: (id, title) => this.renameProject(id, title),
      duplicateProject: (id) => this.duplicateProject(id),
      deleteProject: (id) => this.deleteProject(id),
      undoDeleteProject: () => this.undoDeleteProject(),
      saveProjectFile: (id) => this.saveProjectFile(id),
      saveProjectNow: () => this.saveProjectNow(),
      saveFile: () => this.saveFile(),
      openFile: (file) => this.openFile(file),
    };
  }

  /** Draws now; a frame still pending would only draw the same view again. */
  #emit(): void {
    this.#frame.cancel();
    if (this.#viewListeners.size === 0) return;
    const view = this.view();
    for (const listener of this.#viewListeners) listener(view);
  }
}
