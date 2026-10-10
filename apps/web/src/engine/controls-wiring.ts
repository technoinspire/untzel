// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The running controls over the session and the engine: the language's editors, the
// auditions, the share and export options. Part of the boot chunk.
import { instrumentHashes, type Engine } from "@untzel/audio/main";
import { liveStrings as strings } from "@untzel/skin";
import type { InstrumentManifest, InstrumentRegistry } from "@untzel/core";
import type { Audition, Session } from "@untzel/session";
import type { TemplateCatalog } from "@untzel/templates";
import { DeviceProbeStore } from "../adapters/controls/export/device-probe-store";
import type { PreviewNoteAudition } from "../adapters/note-audition";
import { createSessionControls, type RunningControls, type SessionControlsOptions } from "../adapters/session-controls-port";
import { languageSoundEditor, languageSourceEditor } from "../adapters/source-editor";
import type { ConsoleDiagnosticsLog } from "../diagnostics/diagnostics-log";
import exportWorkerUrl from "../export.worker?worker&url";
import { deviceTraits } from "../page/device-traits";
import type { LightRelay } from "../page/light-relay";
import type { MotionSetting } from "../page/motion-setting";
import { templateCatalogView } from "../page/start/template-catalog-view";
import { stillKeepOut } from "../stage/stage-keep-out";
import { pageStorage } from "./page-storage";

type ShareOptions = SessionControlsOptions["share"];
type ExporterOptions = SessionControlsOptions["exporter"];

/** What the export needs from the page and the build, beside the engine. */
export interface ExportSources {
  readonly registry: InstrumentRegistry;
  readonly instruments: readonly InstrumentManifest[];
  /** The compiled DSP the export's worker runs; read when an export starts (a retry replaces it). */
  readonly module: () => Promise<WebAssembly.Module>;
  readonly logoUrl: string;
  readonly motion: MotionSetting;
  readonly light: LightRelay;
}

export interface ControlsInputs {
  readonly context: AudioContext;
  readonly session: Session;
  readonly engine: Engine;
  readonly templates: TemplateCatalog;
  readonly log: ConsoleDiagnosticsLog;
  readonly auditions: { readonly library: Audition; readonly notes: PreviewNoteAudition };
  readonly share: ShareOptions;
}

export function controlsFor(inputs: ControlsInputs, sources: ExportSources): RunningControls {
  const { context, session, engine, templates, log, auditions, share } = inputs;
  const { registry } = sources;
  return createSessionControls({
    session,
    sound: engine.sound,
    editor: languageSourceEditor(registry),
    audition: auditions.notes,
    libraryAudition: auditions.library,
    soundEditor: languageSoundEditor(registry),
    registry,
    templates: templateCatalogView(templates),
    selectedTemplate: templates.firstTouch ?? "",
    nowFrame: () => engine.clock.nowFrame(),
    sampleRate: engine.clock.sampleRate,
    resumeAudio: () => {
      if (context.state !== "running") void context.resume();
    },
    log,
    share,
    exporter: exporterOptions(log, engine, sources),
  });
}

function exporterOptions(log: ConsoleDiagnosticsLog, engine: Engine, sources: ExportSources): ExporterOptions {
  return {
    load: () => import("@untzel/export"),
    module: sources.module,
    instrumentHashes: instrumentHashes(sources.instruments),
    samplePacks: (program) => engine.samples.packsFor(program),
    workerUrl: exportWorkerUrl,
    logoUrl: sources.logoUrl,
    fonts: document.fonts,
    probes: new DeviceProbeStore(pageStorage(), deviceTraits()),
    reducedMotion: () => sources.motion.isReduced(),
    // The preview's still: the live scene drawn the way the file draws it.
    sceneStill: (size) => sources.light.still(size, stillKeepOut()),
    internalError: (error) => log.internalError("export", error),
    now: () => new Date(),
    performanceNow: () => performance.now(),
    untitled: () => strings.untitled,
  };
}
