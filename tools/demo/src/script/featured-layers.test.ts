// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { simRegistry } from "@untzel/sim/registry";
import { describe, expect, it } from "vitest";
import { MAX_FEATURED_LAYERS, featuredTracks } from "./featured-layers";
import { readTemplate, type TemplateTrack } from "./template";

const { registry } = simRegistry();

function tracksOf(source: string): readonly TemplateTrack[] {
  const read = readTemplate(source, registry);
  if (!read.ok) throw new Error("the text must play");
  return read.template.tracks;
}

const names = (tracks: readonly TemplateTrack[]): string[] => tracks.map((track) => track.track.name);

const BAND = [
  "pad: pad Cm ~ ~ ~",
  "hat: hat ..x. ..x. ..x. ..x.",
  "lead: lead c4 . . . eb4 . . .",
  "kick: kick x... x... x... x...",
  "clap: clap .... x... .... x...",
  "sub: sub c1 . . . c1 . . .",
  "bass: bass c2 . . . c2 . . .",
  "riser: riser x...",
  "choir: choir c4 ~ ~ ~",
  "keys: epiano c4 . . . . . . .",
].join("\n");

describe("featuredTracks", () => {
  it("takes the first track of each family in producer order, a voice before an FX", () => {
    expect(names(featuredTracks(tracksOf(BAND), null))).toEqual(["kick", "sub", "hat", "pad", "lead", "choir"]);
  });
  it("takes an FX when there is no voice, and never more than six", () => {
    const tracks = tracksOf(BAND.replace("choir: choir c4 ~ ~ ~", ""));
    const featured = featuredTracks(tracks, null);
    expect(names(featured).at(-1)).toBe("riser");
    expect(featured.length).toBeLessThanOrEqual(MAX_FEATURED_LAYERS);
  });
  it("leaves out the families a template does not have", () => {
    expect(names(featuredTracks(tracksOf("bass: bass c2 . . . c2 . . .\npad: pad Cm ~ ~ ~\n"), null))).toEqual(["bass", "pad"]);
  });
  it("builds the tracks a demo file names, in producer order", () => {
    expect(names(featuredTracks(tracksOf(BAND), ["keys", "kick", "clap"]))).toEqual(["kick", "clap", "keys"]);
  });
  it("refuses a name the template does not have", () => {
    expect(() => featuredTracks(tracksOf(BAND), ["kick", "snare"])).toThrow("snare");
  });
});
