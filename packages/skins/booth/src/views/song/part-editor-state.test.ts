// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { viewFixture } from "../../testing/view-fixture";
import { partEditorState } from "./part-editor-state";

describe("partEditorState", () => {
  it("names the part, where it sits and how long it lasts", () => {
    const state = partEditorState(viewFixture(), 1);
    expect(state?.section).toBe("drop");
    expect(state?.meta).toBe("part 2 of 3 · bars 9–24");
    expect(state?.lengthLabel).toBe("16 bars");
    expect(state?.lengthName).toBe("Part length 16 bars");
  });

  it("says when the section plays in more than one part", () => {
    expect(partEditorState(viewFixture(), 1)?.shared).toBe("Plays 2 times in the song: its tracks change in each.");
    expect(partEditorState(viewFixture(), 0)?.shared).toBeNull();
  });

  it("lists every track, on or off in the part", () => {
    expect(partEditorState(viewFixture(), 0)?.tracks).toEqual([
      { track: "kick", label: "kick", name: "kick in intro", isMember: true },
      { track: "bass", label: "bass · off", name: "bass in intro", isMember: false },
    ]);
  });

  it("moves a part within the song", () => {
    const first = partEditorState(viewFixture(), 0);
    expect([first?.canMoveUp, first?.canMoveDown]).toEqual([false, true]);
    expect(partEditorState(viewFixture({ isPlaying: false }), 2)).toMatchObject({ canMoveDown: false });
    expect(partEditorState(viewFixture(), 3)).toBeNull();
  });
});
