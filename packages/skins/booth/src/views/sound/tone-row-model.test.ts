// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { toneRemovedSubject, toneRowModel } from "./tone-row-model";

describe("toneRowModel", () => {
  it("is active when nothing written overrides tone", () => {
    expect(toneRowModel(0.5, [])).toEqual({ isActive: true, setBy: null, setByParts: [], useNote: null, display: "0.50" });
  });

  it("says who is in control and what Use Tone removes", () => {
    const model = toneRowModel(0.5, [{ parameter: "open", isSignal: false }]);
    expect(model).toMatchObject({ isActive: false, setBy: "Set by open" });
    expect(model.useNote).toBe("Removes open from the text, so Tone shapes the sound again.");
  });

  it("names several parameters and a signal", () => {
    expect(toneRowModel(0.5, [{ parameter: "open", isSignal: false }, { parameter: "cutoff", isSignal: false }]).setBy).toBe("Set by open and cutoff");
    expect(toneRowModel(0.5, [{ parameter: "cutoff", isSignal: true }]).setBy).toBe("Set by cutoff (a signal)");
  });

  it("gives the view the sentence in pieces, the parameter names as code", () => {
    const three = [
      { parameter: "open", isSignal: false },
      { parameter: "cutoff", isSignal: false },
      { parameter: "drive", isSignal: false },
    ];
    expect(toneRowModel(0.5, three).setByParts).toEqual([
      { text: "Set by ", isCode: false },
      { text: "open", isCode: true },
      { text: ", ", isCode: false },
      { text: "cutoff", isCode: true },
      { text: " and ", isCode: false },
      { text: "drive", isCode: true },
    ]);
    expect(toneRowModel(0.5, [{ parameter: "cutoff", isSignal: true }]).setByParts.at(-1)).toEqual({ text: " (a signal)", isCode: false });
  });

  it("words the toast after Use Tone", () => {
    expect(toneRemovedSubject(["open"])).toBe("open");
    expect(toneRemovedSubject(["cutoff", "resonance"])).toBe("cutoff and resonance");
  });
});
