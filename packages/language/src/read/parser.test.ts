// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { parser } from "./parser";

const ONBOARD_PHASE_1 = `// onboard (phase 1: kick, hat and bass only)
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

function syntaxErrorCount(source: string): number {
  let errors = 0;
  parser.parse(source).iterate({
    enter: (node) => {
      if (node.type.isError) errors += 1;
    },
  });
  return errors;
}

describe("untzel.grammar", () => {
  it("parses the onboard template without syntax errors", () => {
    expect(syntaxErrorCount(ONBOARD_PHASE_1)).toBe(0);
  });
});
