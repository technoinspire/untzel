// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { strings } from "../../copy/copy";
import { songModeState } from "./song-view";
describe("songModeState", () => {
  it("offers song mode once the song has a part", () => {
    expect(songModeState(3)).toEqual({ isSongDisabled: false, note: strings.songInLoop });
  });
  it("makes Song inert and says how to start without parts", () => {
    expect(songModeState(0)).toEqual({ isSongDisabled: true, note: strings.noParts });
  });
});
