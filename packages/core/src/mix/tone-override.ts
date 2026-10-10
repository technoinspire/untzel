// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest } from "../manifest/manifest-types";

// Tone moves the parameters of the manifest's tone mapping. A parameter written in the
// text wins over tone, so a Tone slider over it would do nothing.
// So the control shows who is in charge and offers to hand it back.

/** A parameter as the track writes it. */
export interface WrittenParameter {
  readonly name: string;
  /** Written in the text. */
  readonly explicit: boolean;
  /** A signal drives it (`cutoff sine(8) 300..2400`). */
  readonly isSignal: boolean;
}

export interface ToneOverride {
  readonly parameter: string;
  readonly isSignal: boolean;
}

/** The written parameters that tone would move, in the manifest's mapping order; empty when Tone is in control. */
export function toneOverriddenBy(manifest: InstrumentManifest, written: readonly WrittenParameter[]): readonly ToneOverride[] {
  return manifest.tone.flatMap((mapping) => {
    const found = written.find((parameter) => parameter.name === mapping.parameter && parameter.explicit);
    return found === undefined ? [] : [{ parameter: found.name, isSignal: found.isSignal }];
  });
}
