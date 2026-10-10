// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentRegistry } from "@untzel/core";
import { Composer } from "../proposal/composer";
import type { Describer } from "../proposal/describer";

// Test fixture: the tests pass a registry (registryWith, from @untzel/instrument-index/testing).

export function composerOf(registry: InstrumentRegistry, describer?: Describer): Composer {
  return new Composer(registry, describer);
}

/** The onboard template, as the app starts. */
export const ONBOARD = `// onboard (phase 1: kick, hat and bass only)
tempo 132
key c minor
kick:  kick  x... x... x... x...          | drive 0.3
hat:   hat   ..x. ..x. ..x. ..xx          | swing 0.12
ride:  hat   x.x. x.x. x.x. x.x.          | open 0.7 | gain 0.4 | pan -0.3
sub:   bass  c1 . . c1 . . c1 .           | cutoff 180
bass:  bass  . c2 . c2 . c2 . eb2         | cutoff sine(8) 300..1400 | pan 0.2
section intro  kick hat sub
section build  kick hat ride sub
section drop   kick hat ride sub bass
section break  hat bass
song intro 8, build 4, drop 16, break 8, build 4, drop 16
`;
