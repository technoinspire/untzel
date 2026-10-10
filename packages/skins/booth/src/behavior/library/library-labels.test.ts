// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { auditionAnnouncement, resultsLabel, trackPlaysLabel } from "./library-labels";

const piano = (sound: string) => ({ instrument: "piano", sound, key: "c minor", pattern: null });

describe("auditionAnnouncement", () => {
  it("announces the instrument and the sound when the audition starts or switches", () => {
    expect(auditionAnnouncement(null, piano("grand"))).toBe("Playing piano, grand");
    expect(auditionAnnouncement(piano("grand"), piano("felt"))).toBe("Playing piano, felt");
    expect(auditionAnnouncement(piano("grand"), { instrument: "epiano", sound: "tine", key: "c minor", pattern: null })).toBe("Playing epiano, tine");
  });
  it("announces the end once and stays quiet while nothing changes", () => {
    expect(auditionAnnouncement(piano("grand"), null)).toBe("Preview stopped");
    expect(auditionAnnouncement(null, null)).toBeNull();
    expect(auditionAnnouncement(piano("grand"), piano("grand"))).toBeNull();
  });
});

describe("resultsLabel", () => {
  it("counts the matches", () => {
    expect(resultsLabel(1)).toBe("1 result");
    expect(resultsLabel(2)).toBe("2 results");
  });
});

describe("trackPlaysLabel", () => {
  it("says which track plays which sound while Change sound previews", () => {
    expect(trackPlaysLabel("bass", "acid", "squelch")).toBe("bass plays acid \u00b7 squelch in the music");
  });
});
