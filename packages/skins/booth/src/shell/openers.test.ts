// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { UiState } from "./navigation";
import { nextOpeners, type Openers } from "./openers";

const closed: UiState = {
  tab: "tracks",
  panel: null,
  isCodeShown: false,
  overlay: null,
  selectedTrack: null,
  libraryTrack: null,
  selectedPart: null,
  lengthTarget: "loop",
};
const none: Openers<string> = { overlay: null, code: null, panel: null };

describe("nextOpeners", () => {
  it("remembers the control outside the panel that opened it", () => {
    expect(nextOpeners(none, closed, { ...closed, panel: "track" }, "tile", false)).toEqual({ overlay: null, code: null, panel: "tile" });
  });
  it("a control inside the panel hands focus back to the opener before it", () => {
    const withLibrary = { ...closed, overlay: "library" } as const;
    const opened = nextOpeners(none, closed, withLibrary, "add", false);
    expect(nextOpeners(opened, withLibrary, { ...closed, panel: "track" }, "chip", true)).toEqual({ overlay: null, code: null, panel: "add" });
  });
  it("the length picker goes back to its chip, even inside the panel", () => {
    const withDetail = { ...closed, panel: "track" } as const;
    const opened = nextOpeners(none, closed, withDetail, "tile", false);
    expect(nextOpeners(opened, withDetail, { ...withDetail, overlay: "length" }, "pattern chip", true)).toEqual({
      overlay: "pattern chip",
      code: null,
      panel: "tile",
    });
  });
  it("the code goes back to the Code button that opened it", () => {
    expect(nextOpeners(none, closed, { ...closed, isCodeShown: true }, "code button", false)).toEqual({ overlay: null, code: "code button", panel: null });
  });
  it("forgets a layer once it is closed", () => {
    const open: Openers<string> = { overlay: "a", code: "c", panel: "b" };
    expect(nextOpeners(open, { ...closed, panel: "track", overlay: "length" }, closed, null, false)).toEqual(none);
  });
});
