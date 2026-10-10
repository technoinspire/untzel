// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Every screen over the fake session. Used by this preview and by apps/web with ?sim=1.
// createCodeEditor adopts the editor CSS itself.

import { SOURCE_LOCALE, createTranslator } from "@untzel/i18n";
import { createShell, type Shell } from "@untzel/skin-booth";
import { createCodeEditor, type CodeEditor } from "@untzel/editor";
import { createStage, latencyCompensatedClock, type LightProgram } from "@untzel/light";
import { PREVIEW_KEEP_OUT } from "./preview-light";
import { createFakeSession, type FakeOptions, type FakeSession } from "./fake-session/fake-session";
import { phase1, stressed, wireframe, type Fixture } from "./fake-session/fixtures";
import type { PageFlags } from "./page-flags";
import { SCREENS, isScreenName, type ScreenPreset } from "./skins/booth/screens";

const LIGHT_LATENCY_S = 0.02;

export interface SimulatedPage {
  readonly session: FakeSession;
  readonly shell: Shell;
}

/** The screen preset's state for the fake session. */
function fakeOptions(preset: ScreenPreset, fixture: Fixture, flags: PageFlags): FakeOptions {
  return {
    fixture,
    phase: preset.phase,
    mode: preset.mode,
    still: flags.still,
    exportProgress: preset.exportProgress,
    ...(preset.exportStatus === undefined ? {} : { exportStatus: preset.exportStatus }),
    ...(preset.shareLink === undefined ? {} : { shareLink: preset.shareLink }),
    ...(preset.notice === undefined ? {} : { notice: preset.notice }),
    withError: preset.withError,
    withChange: preset.withChange,
    template: flags.template,
  };
}

/** The light stage over the fake session's cues and clock. */
function mountPreviewStage(host: HTMLElement, session: FakeSession, flags: PageFlags): void {
  const stage = createStage({
    host,
    clock: latencyCompensatedClock(() => session.now(), () => LIGHT_LATENCY_S),
    keepOut: PREVIEW_KEEP_OUT,
    ...(flags.renderer === null ? {} : { prefer: flags.renderer }),
    reducedMotion: flags.reducedMotion,
    onReady: (kind) => (document.documentElement.dataset["renderer"] = kind),
    onError: (error) => console.warn("Stage fell back:", error),
  });
  let program: LightProgram | null = null;
  session.onCues((light) => {
    if (light.program !== program) stage.setProgram((program = light.program));
    stage.schedule(light.cues, light.timeline);
  });
  session.onStageMode((mode) => stage.setMode(mode));
}

export function mountSimulated(root: HTMLElement, flags: PageFlags, wordmarkUrl: string): SimulatedPage {
  const hasScreen = isScreenName(flags.screen);
  const preset: ScreenPreset = SCREENS[hasScreen ? flags.screen : "A"];
  const base = flags.wireframe ? wireframe : phase1;
  const fixture = flags.stress === null ? base : stressed(base, flags.stress);
  const session = createFakeSession(fakeOptions(preset, fixture, flags));
  let editor: CodeEditor | null = null;
  const shell = createShell({
    root,
    port: session,
    exportLogoUrl: "/brand/untzel-lockup-dark.png",
    wordmarkUrl,
    initial: { ...preset.ui, selectedTrack: preset.ui.panel === "track" ? fixture.detail : null },
    // A named state shows what it names; without one the stored preference applies.
    ...(hasScreen ? { initialCollapsed: preset.collapsed } : {}),
    ...(fixture.detailStep === null ? {} : { initialStep: fixture.detailStep }),
    mountStage: (host) => mountPreviewStage(host, session, flags),
    mountEditor(host) {
      editor = createCodeEditor({ host, port: session.codePort(), changedLineMs: flags.still ? 60_000 : 1000 });
    },
    onApplyNow: () => editor?.applyNow(),
    // The preview fixes the setting the page's source owns: full motion.
    motion: { isReduced: () => flags.reducedMotion, isFollowingSystem: () => true, toggle: () => undefined, onChange: () => () => undefined },
    translator: createTranslator(SOURCE_LOCALE),
    version: "preview",
  });
  return { session, shell };
}
