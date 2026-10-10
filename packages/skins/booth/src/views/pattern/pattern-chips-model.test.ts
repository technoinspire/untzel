// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { track } from "../../testing/view-fixture";
import { chipAction, patternChipsModel } from "./pattern-chips-model";
/** One string for every preview of an existing track. */
const TRACK_PREVIEW_NOTE = "From the next bar, for 16 bars. Not in the text yet.";

const kick = { ...track("kick", "drum"), patterns: ["Four on the floor", "Broken", "Half time"] };

describe("patternChipsModel", () => {
  it("marks the chip the text plays", () => {
    const model = patternChipsModel({ ...kick, currentPattern: "Four on the floor" });
    expect(model.chips.map((chip) => chip.isCurrent)).toEqual([true, false, false]);
    expect(model.caption).toBeNull();
    expect(model.label).toBe("Patterns for kick");
  });

  it("says Your own pattern when the text is none of them (also after the key changed)", () => {
    expect(patternChipsModel({ ...kick, currentPattern: null }).caption).toBe("Your own pattern");
  });

  it("shows the preview box while a chip plays, with one sentence for every preview", () => {
    const model = patternChipsModel({ ...kick, currentPattern: "Four on the floor", previewing: "Broken" });
    expect(model.chips.map((chip) => chip.isPreviewing)).toEqual([false, true, false]);
    expect(model.preview).toEqual({ title: "Previewing Broken", note: TRACK_PREVIEW_NOTE, useLabel: "Use Broken", announcement: `Previewing Broken. ${TRACK_PREVIEW_NOTE}` });
  });

  it("ignores a sound preview of Change sound", () => {
    expect(patternChipsModel({ ...kick, previewing: "acid · squelch" }).preview).toBeNull();
  });

  it("a tap previews, a second tap on the same chip writes it, the current chip does nothing", () => {
    const idle = patternChipsModel({ ...kick, currentPattern: "Four on the floor" });
    expect(chipAction(idle, "Broken")).toBe("preview");
    expect(chipAction(idle, "Four on the floor")).toBe("none");
    expect(chipAction(patternChipsModel({ ...kick, previewing: "Broken" }), "Broken")).toBe("use");
  });
});
