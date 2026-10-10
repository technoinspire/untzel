// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The synchronous parts of the engine's start (App.#ensureRunning calls them between its
// awaits, in this order): the DSP module and the transport worker, the session and its
// stores, the share options with the received text's autosave, and the running record.
// Part of the boot chunk.
import { compileDsp, type Engine } from "@untzel/audio/main";
import { createTransportWorker } from "@untzel/audio/preload";
import { remixTitle } from "@untzel/skin";
import type { InstrumentRegistry, Program } from "@untzel/core";
import { analyze, setTitleEdit, titleOf, type AnalyzeResult } from "@untzel/language";
import { Audition, Session, TitleEdits, type SourceStore } from "@untzel/session";
import { createSourceStore } from "@untzel/share";
import { SessionCodePort, SoundingFeed } from "../adapters/code-port";
import { PreviewNoteAudition } from "../adapters/note-audition";
import type { ProjectControls } from "../adapters/project-controls";
import { withTitle } from "../adapters/project-library";
import type { RunningControls, SessionControlsOptions } from "../adapters/session-controls-port";
import { SessionTerminalPort } from "../adapters/terminal-port";
import type { CalibrationScheduler } from "../diagnostics/calibration";
import { ConsoleDiagnosticsLog } from "../diagnostics/diagnostics-log";
import type { Autosave } from "../page/autosave";
import type { LightRelay } from "../page/light-relay";
import { markStartup } from "../diagnostics/startup-marks";
import { wireLight, wireSound, type EngineReadings } from "./live-wiring";
import { pageStorage } from "./page-storage";
import { withSamplesFor } from "./sample-preview";

/** Everything one tapped context runs; a retry or another context disposes it. */
export interface Running {
  readonly engine: Engine;
  readonly session: Session;
  readonly controls: RunningControls;
  readonly code: SessionCodePort;
  readonly terminal: SessionTerminalPort;
  readonly store: SourceStore;
  readonly audition: PreviewNoteAudition;
  readonly titles: TitleEdits;
  autosave: Autosave | null;
}

/** The session and what reads and keeps its text, made before the template catalog's await. */
export interface SessionParts {
  readonly log: ConsoleDiagnosticsLog;
  readonly analyzeText: (source: string) => AnalyzeResult;
  readonly session: Session;
  readonly store: SourceStore;
  readonly libraryAudition: Audition;
  readonly audition: PreviewNoteAudition;
}

export function compileEngineModule(dsp: string, calibration: CalibrationScheduler, started?: Promise<WebAssembly.Module>): Promise<WebAssembly.Module> {
  const module = compileDsp(dsp, started);
  module.then(
    (compiled) => {
      markStartup("dsp-compiled");
      calibration.moduleReady(compiled);
    },
    (error: unknown) => console.error("Untzel couldn't compile", dsp, error),
  );
  return module;
}

/** The preloaded worker the first time, a new one after a retry. */
export function workerSource(preloaded: Worker | null, url: string): () => Worker {
  let waiting = preloaded;
  return () => {
    const worker = waiting ?? createTransportWorker(url);
    waiting = null;
    return worker;
  };
}

/** Dev and test builds: ?seed replaces the hash that seeds "?" and rand. */
function withSeed(result: AnalyzeResult, seed: number | null): AnalyzeResult {
  if (seed === null || !result.ok) return result;
  const program: Program = { ...result.program, sourceHash: seed, seedDependent: true };
  return { ...result, program };
}

export function assembleSession(engine: Engine, registry: InstrumentRegistry, seed: number | null): SessionParts {
  const log = new ConsoleDiagnosticsLog();
  const analyzeText = (source: string): AnalyzeResult => withSeed(analyze(source, registry), seed);
  const session = new Session({ sound: engine.sound, load: engine.load, log, analyze: analyzeText });
  const store = createSourceStore({
    storage: pageStorage(),
    pageUrl: window.location.origin + window.location.pathname,
    now: () => new Date(),
  });
  // One preview path for both auditions: the library's and every touched note's.
  const libraryAudition = new Audition({ session, port: withSamplesFor(engine), registry, analyze: (source) => analyze(source, registry), log });
  const audition = new PreviewNoteAudition(libraryAudition);
  return { log, analyzeText, session, store, libraryAudition, audition };
}

/** The share controls' options; received text rebases the autosave of the running record. */
export function shareOptionsFor(parts: SessionParts, projects: ProjectControls, autosave: () => Autosave): SessionControlsOptions["share"] {
  const retitle = (text: string, origin: "link" | "file"): string => (origin === "link" ? (withTitle(text, remixTitle(titleOf(text))) ?? text) : text);
  const received: Autosave = {
    rebase: (text) => {
      projects.detach(text);
      autosave().rebase(text);
    },
    flush: () => autosave().flush(),
    dispose: () => undefined,
  };
  return { store: parts.store, analyze: parts.analyzeText, autosave: () => received, retitle, now: () => new Date() };
}

export interface RunningInputs {
  readonly context: AudioContext;
  readonly engine: Engine;
  readonly parts: SessionParts;
  readonly controls: RunningControls;
  readonly registry: InstrumentRegistry;
  readonly light: LightRelay;
  readonly projects: ProjectControls;
  readonly readings: EngineReadings;
}

/** After the controls: the editor's and the terminal's ports, the live wiring, the record. */
export function assembleRunning(inputs: RunningInputs): Running {
  const { context, engine, parts, controls, projects } = inputs;
  const { session } = parts;
  const sounding = new SoundingFeed(() => engine.clock.seconds());
  const code = new SessionCodePort(session, controls.feedback, sounding);
  const terminal = new SessionTerminalPort({
    session,
    edits: controls.edits,
    resumeAudio: () => {
      if (context.state !== "running") void context.resume();
    },
  });
  wireLight(engine, session, inputs.registry, inputs.light);
  wireSound(engine, session, controls, sounding, inputs.readings);
  const titles = new TitleEdits({ session, editor: { setTitleEdit } });
  session.subscribe(() => {
    projects.sessionChanged();
    projects.playbackChanged();
  });
  controls.ranges.subscribe(() => projects.playbackChanged());
  return { engine, session, controls, code, terminal, store: parts.store, audition: parts.audition, titles, autosave: null };
}

/** Stops everything one context ran, the context last. */
export function disposeRunning(running: Running): void {
  running.autosave?.dispose();
  running.controls.dispose();
  running.session.dispose();
  running.engine.sound.dispose();
  void running.engine.context.close().catch(() => undefined);
}
