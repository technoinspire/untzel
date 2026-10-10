// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { IconName } from "../icons";
import { strings } from "../../copy/copy";

// The track area with no track: never an empty table, but "Start with a
// sound", Add track as the primary action and four starters whose first tap plays.

export interface StarterView {
  readonly instrument: string;
  readonly label: string;
  /** "Add kick and play". */
  readonly name: string;
  readonly icon: IconName;
}

export interface TrackEmptyStateModel {
  readonly title: string;
  readonly hint: string;
  readonly lead: string;
  readonly starters: readonly StarterView[];
}

const STARTERS: Readonly<Record<string, { readonly label: () => string; readonly icon: IconName }>> = {
  kick: { label: () => strings.starterKick, icon: "starter-kick" },
  bass: { label: () => strings.starterBass, icon: "starter-bass" },
  hat: { label: () => strings.starterHats, icon: "starter-hats" },
  pad: { label: () => strings.starterChords, icon: "starter-chords" },
};

/** `available`: the starter instruments the library has, in the session's order. */
export function trackEmptyStateModel(available: readonly string[]): TrackEmptyStateModel {
  return {
    title: strings.startWithSound,
    hint: strings.startWithSoundHint,
    lead: strings.tapToHear,
    starters: available.flatMap((instrument) => {
      const starter = STARTERS[instrument];
      return starter === undefined ? [] : [{ instrument, label: starter.label(), name: strings.addAndPlay(instrument), icon: starter.icon }];
    }),
  };
}
