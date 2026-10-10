// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("@untzel/core public surface", () => {
  it("fixes the general parameter indices", () => {
    expect(core.GeneralParameter).toEqual({
      gain: 0,
      pan: 1,
      reverbSend: 2,
      reverbSpace: 3,
      delaySend: 4,
      delayDivision: 5,
      duck: 6,
      glide: 7,
      legato: 8,
      audible: 9,
    });
    expect(core.EFFECT_PARAMETER_OFFSET).toBe(16);
    expect(core.INSTRUMENT_PARAMETER_OFFSET).toBe(32);
  });
});
