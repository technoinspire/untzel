// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Composition root, loaded after the waiting stage is on screen. Asset URLs are resolved
// here (Vite suffixes) and handed to @untzel/audio, which knows nothing about Vite. The
// engine's parts live in engine/; this file wires them around the start's three awaits.
import { LoadMeter, createEngine, type Engine, type EngineOptions } from "@untzel/audio/main";
import type { AudioAssetUrls, PreloadedAudio } from "@untzel/audio/preload";
import { liveStrings as strings, remixTitle } from "@untzel/skin";
import { analyze, titleOf } from "@untzel/language";
import type { PlaybackMode, PlayRange } from "@untzel/session";
import { browserProjectControls } from "./adapters/browser-project-controls";
import type { ProjectControls, ProjectPage } from "./adapters/project-controls";
import type { ProjectPlayback } from "@untzel/session/projects";
import { withTitle } from "./adapters/project-library";
import type { PageFlags } from "@untzel/ui-preview/page-flags";
import type { RunningControls } from "./adapters/session-controls-port";
import { CalibrationScheduler } from "./diagnostics/calibration";
import type { EditorHandle } from "./engine/editor-mount";
import { pageTranslator } from "./strings/copy";
import { NO_AUTOSAVE, startAutosave } from "./engine/autosave-start";
// Before controls-wiring: the order the boot graph first reaches @untzel/light and
// stage-keep-out names the chunk boot shares with stage-mount (stage-keep-out, as before).
import { assembleRunning, assembleSession, compileEngineModule, disposeRunning, shareOptionsFor, workerSource, type Running } from "./engine/engine-assembly";
import type { EngineReadings } from "./engine/live-wiring";
import { controlsFor } from "./engine/controls-wiring";
import { pageStorage } from "./engine/page-storage";
import { templateSource } from "./engine/template-source";
import type { StartSource } from "./page/deferred-controls-port";
import type { LightRelay } from "./page/light-relay";
import type { MotionSetting } from "./page/motion-setting";
import { firstTextOf, type FirstText } from "./page/start/first-text";
import { buildRegistry } from "@untzel/instrument-index";
import { markStartup } from "./diagnostics/startup-marks";
import { templateCatalog } from "./catalog/templates";
import { templateSummaries } from "./adapters/template-summaries";
import { templateCatalogView } from "./page/start/template-catalog-view";
import { VOICE_PACKS } from "./generated/voice-packs";
import type { TemplateCatalogView } from "@untzel/presentation/view-model";
export type StartOutcome =
  | {
      readonly kind: "running";
      readonly controls: RunningControls;
      /** Said after "Playing" when the received text could not play and the onboard plays instead. */
      readonly notice: string | null;
    }
  | { readonly kind: "blocked" }
  | { readonly kind: "unsupported" }
  | { readonly kind: "load-failed" };

export interface AppOptions {
  readonly flags: PageFlags;
  readonly light: LightRelay;
  /** performance.now() of the gesture that started the sound (first-sound measurement). */
  readonly tappedAt: () => number | null;
  /** performance.now() when the context first reported "running" (frame 0). */
  readonly runningAt: () => number | null;
  readonly urls: AudioAssetUrls;
  /** Started by the initial JS while the page loads; used once, then retries start over. */
  readonly preloaded: PreloadedAudio;
  /** brand/untzel-lockup-dark.png, for the mark and the closing card of every video. */
  readonly logoUrl: string;
  /** What the project library asks of the page: the waiting screen, the tap, a file. */
  readonly projectPage: ProjectPage;
  /** The page's one source of reduced motion. */
  readonly motion: MotionSetting;
  /** createEngine by default; the test build's ?demo page passes the demo's own. */
  readonly createEngine?: (options: EngineOptions) => Promise<Engine>;
}

export class App {
  /** The project library: there before the first tap, for the menu and Continue. */
  readonly projects: ProjectControls;
  readonly #options: AppOptions;
  readonly #built = buildRegistry();
  readonly #meter = new LoadMeter(this.#built.instruments);
  readonly #calibration: CalibrationScheduler;
  #module: Promise<WebAssembly.Module>;
  /** Made while the page loads, so the tap does not wait for the worker's script. */
  readonly #takeWorker: () => Worker;
  #running: Running | null = null;
  #editor: EditorHandle | null = null;
  readonly #readings: EngineReadings = { stats: null, startFrame: null };

  constructor(options: AppOptions) {
    markStartup("boot");
    this.#options = options;
    this.#calibration = new CalibrationScheduler({ ...this.#built, meter: this.#meter });
    this.#takeWorker = workerSource(options.preloaded.worker, options.urls.worker);
    this.#module = compileEngineModule(options.urls.dsp, this.#calibration, options.preloaded.dsp);
    this.projects = browserProjectControls({ registry: this.#built.registry, page: options.projectPage, storage: pageStorage() });
  }

  /** Analysis only, nothing plays: whether received text can be the first play. */
  inspect(source: string): { readonly ok: true } | { readonly ok: false; readonly message: string } {
    const result = analyze(source, this.#built.registry);
    return result.ok ? { ok: true } : { ok: false, message: result.diagnostics[0]?.message ?? "" };
  }

  /** The library with the tempo and key of every project, read from its analyzed program. */
  async templates(): Promise<TemplateCatalogView> {
    const catalog = await templateCatalog();
    return templateCatalogView(catalog, templateSummaries([...catalog.starters, ...catalog.projects], (source) => analyze(source, this.#built.registry)));
  }

  /** A link that arrives while the music plays (hashchange): it plays on the next bar if it analyzes. */
  receiveLink(source: string, mode: PlaybackMode | null, range: PlayRange | null): void {
    this.#running?.controls.share.receiveLink(source, mode, range);
  }

  /** After unlockAudio() in the gesture. */
  // Over 40 lines: the tap's steps in their order, each an await or one call; a split would move an await.
  async start(context: AudioContext, source: StartSource): Promise<StartOutcome> {
    this.#calibration.tapped();
    let running: Running;
    try {
      running = await this.#ensureRunning(context);
    } catch (error) {
      console.error("Untzel couldn't start the engine", error);
      this.#dispose();
      return { kind: "load-failed" };
    }
    const result = await running.session.start();
    if (!result.ok) {
      if (result.reason === "load-failed") this.#dispose();
      return { kind: result.reason };
    }
    markStartup("sound-started");
    this.#calibration.soundStarted();
    // Every tap opens a song: the first one, or another project after the menu switched.
    // The demo builds its song from an empty text.
    const isDemo = import.meta.env.MODE === "test" && this.#options.flags.demo;
    const first = isDemo ? DEMO_FIRST_TEXT : await firstTextOf(source, {
      analyze: (text) => analyze(text, this.#built.registry),
      template: (name) => templateSource(name, this.#built.instruments, this.#options.flags),
      fallback: (await templateCatalog()).firstTouch ?? "",
      project: (id) => this.projects.get(id),
      untitled: (text) => (titleOf(text) === null ? withTitle(text, strings.untitled) ?? text : text),
      remix: (text) => withTitle(text, remixTitle(titleOf(text))) ?? text,
    });
    running.session.openText(first.source);
    // Before the first play, so it starts at the range's first bar.
    running.controls.ranges.receive(first.range);
    const opened = { session: running.session, titles: running.titles, savePending: () => running.autosave?.flush(), playback: () => playbackOf(running) };
    this.projects.open(opened, first.project.id, first.project.templateOrigin, first.source);
    startAutosave(running, first.source, this.projects);
    // Start from scratch: an empty project opens its empty state and
    // waits for the first sound instead of playing silence.
    const isEmpty = running.session.view().tracks.length === 0;
    if (!running.session.view().playing && !isEmpty) {
      markStartup("first-play");
      if (first.mode === null) running.session.play();
      else running.session.play(first.mode);
    }
    return { kind: "running", controls: running.controls, notice: first.notice };
  }

  /** A failed load is retried from scratch: new module, new engine, new context. */
  retry(): void {
    this.#dispose();
    this.#module = compileEngineModule(this.#options.urls.dsp, this.#calibration);
  }

  mountEditor(host: HTMLElement): void {
    const running = this.#running;
    if (running === null || this.#editor !== null) return;
    const ports = { code: running.code, terminal: running.terminal, registry: this.#built.registry, announcer: running.controls.feedback };
    void import("./engine/editor-mount").then(
      ({ mountEditor }) => (this.#editor = mountEditor(host, ports, pageTranslator)),
      (error: unknown) => console.error("Untzel couldn't load the editor", error),
    );
  }

  applyNow(): void {
    this.#editor?.applyNow();
  }

  /** Three awaits, in this order (the DSP module, the engine, the template catalog); the parts between them are synchronous. */
  async #ensureRunning(context: AudioContext): Promise<Running> {
    const current = this.#running;
    if (current !== null && current.engine.context === context) return current;
    this.#dispose();
    const module = await this.#module;
    const { instruments, registry } = this.#built;
    const engine = await (this.#options.createEngine ?? createEngine)({ context, urls: this.#options.urls, instruments, module, meter: this.#meter, worker: this.#takeWorker(), samplePacks: VOICE_PACKS });
    markStartup("engine-created");
    const seed = import.meta.env.DEV || import.meta.env.MODE === "test" ? this.#options.flags.seed : null;
    const parts = assembleSession(engine, registry, seed);
    let running: Running | null = null;
    const templates = await templateCatalog();
    const share = shareOptionsFor(parts, this.projects, () => running?.autosave ?? NO_AUTOSAVE);
    const { session, log } = parts;
    const auditions = { library: parts.libraryAudition, notes: parts.audition };
    const { light, logoUrl, motion } = this.#options;
    const controls = controlsFor({ context, session, engine, templates, log, auditions, share }, { registry, instruments, module: () => this.#module, logoUrl, motion, light });
    running = assembleRunning({ context, engine, parts, controls, registry, light, projects: this.projects, readings: this.#readings });
    this.#running = running;
    void this.#installTestHooks(running);
    return running;
  }

  #dispose(): void {
    const running = this.#running;
    this.#running = null;
    if (running !== null) disposeRunning(running);
  }

  async #installTestHooks(running: Running): Promise<void> {
    // Literal after Vite's replacement: production drops the rest, and the hooks chunk with it.
    if (import.meta.env.MODE !== "test") return;
    const { installTestHooks } = await import("./testing/test-hooks");
    const readings = this.#readings;
    installTestHooks({
      ...running,
      meter: this.#meter,
      light: this.#options.light,
      tappedAt: this.#options.tappedAt,
      runningAt: this.#options.runningAt,
      stats: () => readings.stats,
      startFrame: () => readings.startFrame,
      resetStartFrame: () => (readings.startFrame = null),
    });
    // The same gate as the demo engine and the empty first text: ?demo exists only in the test build.
    if (import.meta.env.MODE === "test" && this.#options.flags.demo) (await import("./testing/demo/demo-hooks")).installDemoHooks({ ...running, logoUrl: this.#options.logoUrl });
  }
}

/** The demo page's first text: empty, a new project, the session's default mode. */
const DEMO_FIRST_TEXT: FirstText = { source: "", mode: null, range: null, notice: null, project: { id: null, templateOrigin: null } };

/** What the open project keeps beside its text: the mode that plays and its range. */
function playbackOf(running: Running): ProjectPlayback | null {
  const mode = running.session.view().mode;
  return mode === null ? null : { mode, range: running.controls.ranges.rangeOf(mode) };
}
export function createApp(options: AppOptions): App {
  // Literal after Vite's replacement: production never reaches the demo engine.
  if (import.meta.env.MODE === "test" && options.flags.demo) {
    const createEngine = (engine: EngineOptions): Promise<Engine> => import("./testing/demo/demo-engine").then((demo) => demo.createDemoEngine(engine));
    return new App({ ...options, createEngine });
  }
  return new App(options);
}
