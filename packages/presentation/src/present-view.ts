// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// SessionView → UntzelView: what the controls render. Pure, so every mapping rule is
// tested in Node. The session owns the music; this only describes it for the screens.

import { pitchClassName, scalePitchClasses, type InstrumentRegistry } from "@untzel/core";
import { STARTER_INSTRUMENTS, type Auditioning, type PlayRangeView, type SessionView } from "@untzel/session";
import { withExportPlayhead } from "./export-playhead";
import { auditionView, libraryView } from "./library-presenter";
import { hintedTrack } from "./loop-section-view";
import { keyLabel } from "./music-names";
import { nowOf } from "./playback-now";
import type { InstrumentDescriptions, ParameterLabels } from "./presentation-copy";
import { trackView } from "./track-presenter";
import { playRangeView, transportView } from "./transport-presenter";
import type { ExportView, ShareView, TemplateCatalogView, UntzelView } from "./view-model";
import { NO_PROJECT } from "./view-model";

export interface PresentContext {
  readonly registry: InstrumentRegistry;
  /** The library's audition now; null when none. */
  readonly audition: Auditioning | null;
  readonly templates: TemplateCatalogView;
  readonly selectedTemplate: string;
  /** The Share and Export sheets: page state, computed by their controls. */
  readonly share: ShareView;
  readonly export: ExportView;
  /** The play range: playback state, beside the session's view. */
  readonly playRange: PlayRangeView;
  /** Frame the context is rendering now, or null before the first sound. */
  readonly nowFrame: number | null;
  readonly sampleRate: number;
  /** The sliders' words in the page's language (the controls' live catalog). */
  readonly labels: ParameterLabels;
  /** The instruments' and sounds' descriptions in the page's language. */
  readonly descriptions: InstrumentDescriptions;
}

export function presentView(view: SessionView, context: PresentContext): UntzelView {
  const now = nowOf(view, context.nowFrame, context.sampleRate);
  const transport = transportView(view, now, context.playRange);
  const hinted = hintedTrack(view, context.registry);
  const song = view.song;
  const key = view.key;
  return {
    phase: "running",
    transport,
    tracks: view.tracks.map((track) => trackView(track, context.registry, now, view, hinted, context)),
    song: {
      sections: view.sections.map((section) => ({ name: section.name, tracks: section.tracks })),
      parts: song?.parts.map((part) => ({ section: part.section, bars: part.bars, start: part.start })) ?? [],
      currentPart: song?.currentPart ?? null,
      playheadBar:
        transport.mode === "song" && transport.bar !== null && transport.totalBars !== null
          ? transport.progress * transport.totalBars
          : null,
    },
    playRange: playRangeView(view, context.playRange, transport),
    scale: {
      label: keyLabel(key),
      notes: (key === null ? [] : scalePitchClasses(key)).map(pitchClassName),
    },
    library: libraryView(view, context.registry, context.descriptions),
    audition: auditionView(context.audition, view, context.registry),
    templates: { catalog: context.templates, selected: context.selectedTemplate, openStyle: null, notice: null },
    share: context.share,
    export: withExportPlayhead(context.export, transport),
    history: { canUndo: view.canUndo, canRedo: view.canRedo },
    starters: STARTER_INSTRUMENTS.filter((instrument) => context.registry.get(instrument) !== undefined),
    // The page's project library fills this in (DeferredControlsPort.setProject).
    project: NO_PROJECT,
  };
}
