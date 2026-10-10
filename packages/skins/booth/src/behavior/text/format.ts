// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ScaleName } from "@untzel/core";
import type { StepView, TrackPlayState, TransportView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";

// Pure formatting of the view model into the screens' copy.

/** "Loop length 8 bars", the accessible name of the Length chip. */
export function loopLengthLabel(bars: number): string {
  return strings.loopLengthOf(bars);
}

/** "Length 8 bars", the visible label of the Length chip. */
export function lengthChipLabel(bars: number): string {
  return phrases.lengthChip(bars);
}

/** "a minor", "f# phrygian": the key as the transport, the template cards and the text write it. */
export function formatKey(tonic: string, scale: ScaleName): string {
  return `${tonic} ${scale}`;
}
/** "132 BPM · c minor": the desktop transport's first line and the video's title card. */
export function tempoAndKey(transport: Pick<TransportView, "bpm" | "key">): string {
  return `${transport.bpm} BPM · ${transport.key}`;
}

export function cpuLabel(cpu: number | null, suffix = ""): string {
  if (cpu === null) return `CPU –${suffix}`;
  return `CPU ${Math.round(cpu * 100)}%${suffix}`;
}

export function isNearLimit(cpu: number | null): boolean {
  return cpu !== null && cpu > 0.8;
}

export function inSongLabel(count: number): string {
  return count === 0 ? strings.newInstrument : strings.inSong(count);
}

export function tileCaption(instrument: string, state: TrackPlayState, section: string | null): string {
  switch (state) {
    case "on":
      return instrument;
    case "off":
      return `${instrument} · ${strings.off}`;
    case "queued":
      return strings.nextBar;
    case "not-in-section":
      return section === null ? `${instrument} · ${strings.off}` : strings.notInSection(section);
  }
}


export function barsLabel(bars: number): string {
  return strings.barCount(bars);
}

export function trackCountLabel(count: number, hidden: number, isDesktop: boolean): string {
  const base = strings.trackCount(count);
  if (hidden <= 0) return base;
  return `${base} · ${isDesktop ? strings.scrollForHidden(hidden) : strings.scrollForMore}`;
}

/** Accessible name of a step button. */
export function stepName(step: number, view: StepView): string {
  return strings.stepName(step + 1, view.label ?? strings[view.kind]);
}

