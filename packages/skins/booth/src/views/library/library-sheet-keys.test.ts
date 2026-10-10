// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { AuditionView, LibraryEntryView } from "@untzel/presentation/view-model";
import { entryAction } from "./library-sheet-keys";
const entry = { instrument: "acid" } as LibraryEntryView;
const playing: AuditionView = { instrument: "acid", sound: "default", key: "a minor", pattern: null };
describe("entryAction", () => {
  it("adds the active row on Enter", () => {
    expect(entryAction("add", entry, null)).toBe("choose");
    expect(entryAction("add", entry, playing)).toBe("choose");
  });
  it("plays the active row on Space, and stops it while it plays", () => {
    expect(entryAction("toggle-preview", entry, null)).toBe("preview");
    expect(entryAction("toggle-preview", entry, { ...playing, instrument: "kick" })).toBe("preview");
    expect(entryAction("toggle-preview", entry, playing)).toBe("stop");
  });
});
