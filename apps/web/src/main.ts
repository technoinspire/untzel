// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Initial JS: the screens, the waiting stage and the gesture unlock. The engine
// (language, session, audio, manifests, WASM), the light stage and the editor load in
// the background. This file only wires the page's
// modules (page/), in the order their side effects must happen.

import "@untzel/skin/styles.css";
import "@untzel/skin/page.css";
import type { AudioAssetUrls } from "@untzel/audio/preload";
import { canPlay } from "@untzel/audio/unlock";
import workletUrl from "@untzel/audio/worklet?worker&url";
import dspUrl from "@untzel/dsp/untzel_dsp.wasm?url";
import { createShell } from "@untzel/skin";
import type { SkinOptions } from "@untzel/skin-contract";
import type { PageFlags } from "@untzel/ui-preview/page-flags";
import type { App } from "./boot";
import { createAudioGesture } from "./page/start/audio-gesture";
import { DeferredControlsPort, type PageActions } from "./page/deferred-controls-port";
import { createEngineLoader } from "./page/start/engine-loader";
import { animationFrames } from "./page/frame-coalescer";
import { drawBeforeInput } from "./page/input-flush";
import { followDocumentTitle } from "./page/document-title";
import { createMotionSetting, type MotionSetting } from "./page/motion-setting";
import { LightRelay } from "./page/light-relay";
import { NO_PAGE_FLAGS } from "./page/no-page-flags";
import { appTranslator, initialLocale } from "./strings/locale";
import { loadLanguage } from "./strings/languages";
import { createReceivedTextFlow } from "./page/received/received-text-flow";
import { createStartFlow } from "./page/start/start-flow";
import { saveWaitingFile, waitingProjects } from "./page/waiting/waiting-projects";
import { announcements } from "./strings/copy";
import { PHASE1_FIXTURE } from "./catalog/template-names";
import type { TemplateCatalog } from "@untzel/templates";
import { initialChoice } from "./page/start/initial-choice";
import { templateCatalogView } from "./page/start/template-catalog-view";
import { TemplateChoiceStore } from "./page/start/template-choice-store";
import { templateCatalog } from "./catalog/templates";
import workerUrl from "./transport.worker?worker&url";

/** Techno Inspire | Untzel, for the mark and the closing card of every video. */
const EXPORT_LOGO_URL = "./brand/untzel-lockup-dark.png";
/** The Untzel wordmark for dark backgrounds: the Graphic Image of the top bar. */
const WORDMARK_URL = "./brand/untzel-wordmark-dark.svg";
// Asset URLs are resolved here (Vite suffixes) and handed to @untzel/audio, which knows nothing about Vite.
const AUDIO_URLS: AudioAssetUrls = { dsp: dspUrl, worklet: workletUrl, worker: workerUrl };

/** Development and test builds only; the dev package is never imported statically. */
async function pageFlags(): Promise<PageFlags> {
  // Written out, not imported: Vite replaces it with a literal, so production drops the branch.
  if (!(import.meta.env.DEV || import.meta.env.MODE === "test")) return NO_PAGE_FLAGS;
  const { PAGE_FLAGS_MARKER, readPageFlags } = await import("@untzel/ui-preview/page-flags");
  const flags = readPageFlags(window.location.search);
  (window as unknown as Record<string, unknown>)[PAGE_FLAGS_MARKER] = flags;
  return flags;
}

// Over 40 lines: one statement per page module, in the order their side effects must run.
function mountEngine(root: HTMLElement, flags: PageFlags, templates: TemplateCatalog, motion: MotionSetting): void {
  const choices = new TemplateChoiceStore(pageStorage());
  const light = new LightRelay();
  const gesture = createAudioGesture();
  const engine = createEngineLoader({
    flags,
    light,
    tappedAt: () => gesture.tappedAt(),
    runningAt: () => gesture.runningAt(),
    urls: AUDIO_URLS,
    logoUrl: EXPORT_LOGO_URL,
    motion,
    projectPage: {
      waitForTap: (next) => {
        port.controls.stop();
        port.waitForTap(next?.kind === "project" ? next.id : null);
      },
      start: (next) => start(next),
    },
  });
  const app = (): Promise<App> => engine.current();
  const start = createStartFlow({ gesture, light, workletUrl, words: announcements, port: () => port, app });
  const received = createReceivedTextFlow({ port: () => port, app });
  const port = createPagePort(templates, flags.template, choices, {
    start,
    retry: () => {
      port.detach();
      engine.retry();
      light.setMode("idle");
      port.start(port.view().templates.selected);
    },
    openFile: received.openFileWhileWaiting,
    projects: waitingProjects(app, start),
    saveWaitingFile: () => saveWaitingFile(app()),
  });
  drawBeforeInput(window, () => port.drawPending());
  followProjects(app(), port);
  received.readLink();
  window.addEventListener("hashchange", received.readLink);
  // The cards gain their tempo and key once the engine's code, which analyzes, has loaded.
  void app().then((loaded) => loaded.templates()).then((described) => port.describeTemplates(described), () => undefined);
  if (port.phase === "unsupported") light.setMode("off");
  mountShell(root, port, { app, light, flags, motion });
}

/** The waiting stage's port, on the template and style tab remembered from the last visit. */
function createPagePort(templates: TemplateCatalog, asked: string | null, choices: TemplateChoiceStore, actions: PageActions): DeferredControlsPort {
  return new DeferredControlsPort({
    phase: canPlay() ? "idle" : "unsupported",
    templates: templateCatalogView(templates),
    choice: initialChoice(templates, asked, choices.load(), PHASE1_FIXTURE),
    onTemplateChoice: (choice) => choices.save(choice),
    frames: animationFrames(window),
    actions,
  });
}

/** The project's title and save state, on the menu and in the document title, once the library loads. */
function followProjects(app: Promise<App>, port: DeferredControlsPort): void {
  const followTitle = followDocumentTitle(document);
  void app.then((loaded) => {
    const show = (): void => {
      const view = loaded.projects.view();
      port.setProject(view);
      followTitle(view.title);
    };
    loaded.projects.onChange(show);
    show();
  });
}

interface ShellParts {
  readonly app: () => Promise<App>;
  readonly light: LightRelay;
  readonly flags: PageFlags;
  readonly motion: MotionSetting;
}

/** Last: the screens, over the deferred port's controls. */
function mountShell(root: HTMLElement, port: DeferredControlsPort, { app, light, flags, motion }: ShellParts): void {
  createShell({
    root,
    port: port.controls,
    exportLogoUrl: EXPORT_LOGO_URL,
    wordmarkUrl: WORDMARK_URL,
    translator: appTranslator(root),
    mountStage: (host) => {
      void import("./stage/stage-mount").then(
        ({ mountStage }) => mountStage(host, light, { prefer: flags.renderer, motion }),
        (error: unknown) => console.warn("Untzel couldn't load the light stage", error),
      );
    },
    mountEditor: (host) => void app().then((loaded) => loaded.mountEditor(host)),
    onApplyNow: () => void app().then((loaded) => loaded.applyNow()),
    motion,
    version: __UNTZEL_VERSION__,
  } satisfies SkinOptions);
}

/** window.localStorage throws in some privacy modes. */
function pageStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const root = document.getElementById("app");
if (root === null) throw new Error("Untzel: missing #app");
const flags = await pageFlags();
// Before anything paints: the sheets, the stage and the export read data-motion.
const motion = createMotionSetting({
  doc: document,
  store: pageStorage(),
  system: typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null,
  isForced: flags.reducedMotion,
});
if ((import.meta.env.DEV || import.meta.env.MODE === "test") && (flags.sim || flags.screen !== null)) {
  void import("@untzel/ui-preview/mount").then(({ mountSimulated }) => {
    const page = mountSimulated(root, flags, WORDMARK_URL);
    (window as unknown as Record<string, unknown>)["untzelPreview"] = page;
  });
} else {
  // The first screen speaks its language: its catalogs load beside the template catalog.
  const [catalog] = await Promise.all([templateCatalog(), loadLanguage(initialLocale(root)).catch(() => undefined)]);
  mountEngine(root, flags, catalog, motion);
}
