// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { analyze } from "@untzel/language";
import type { ParameterView, SessionView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { effectViews, formatNumber, gainSlider, mixParameters, presetViews, soundParameters, toneOf } from "./parameter-view";
import { FAKE_DESCRIPTIONS, FAKE_LABELS, sessionFixture } from "./testing/session-fixture";
const fixture = sessionFixture(registryWith(["acid", "bass", "hat", "kick", "noise", "pad"]), (registry) => (text) => analyze(text, registry));
function trackOf(view: SessionView, name: string) {
  const track = view.tracks.find((candidate) => candidate.name === name);
  if (track === undefined) throw new Error(`no ${name}`);
  return track;
}
const trackIn = (source: string, name: string) => trackOf(fixture.viewOf(source), name);
describe("formatNumber", () => {
  it("keeps two decimals under 10, one under 100 and none above", () => {
    expect([formatNumber(0.7), formatNumber(12.34), formatNumber(900.4)]).toEqual(["0.70", "12.3", "900"]);
  });
});
describe("the words arrive injected", () => {
  it("writes pan with the labels it is given", () => {
    const mix = (pan: string) => mixParameters(trackIn(`bass: bass c2 . . c2 | pan ${pan}\n`, "bass"), FAKE_LABELS).find((row) => row.name === "pan")?.display;
    expect(mix("-0.3")).toBe("left 30");
    expect(mix("0.5")).toBe("right 50");
    expect(mix("0")).toBe("center");
  });
  it("writes a signal over its period and range with signalOver", () => {
    const cutoff = soundParameters(trackIn("bass: bass c2 . . c2 | cutoff sine(8) 300..1400\n", "bass"), fixture.registry.get("bass"), FAKE_LABELS)[0];
    expect(cutoff?.display).toBe("sine 8 bars · 300 Hz–1400 Hz");
    expect(cutoff?.signal?.from).toBeLessThan(cutoff?.signal?.to ?? 0);
  });
  it("writes a gain signal's band with gainRange", () => {
    const signal: ParameterView = { index: 0, name: "gain", value: null, signal: { shape: "saw", periodBars: 8, low: 0.15, high: 0.5, from: 0, to: 1, curve: "linear" }, explicit: true };
    expect(gainSlider(signal, FAKE_LABELS).display).toBe("saw 8 bars · \u221216.5 to \u22126.0 dB");
  });
  it("describes each sound with the descriptions it is given, the default first", () => {
    const manifest = fixture.registry.get("bass");
    const sounds = presetViews(manifest, FAKE_DESCRIPTIONS);
    expect(sounds[0]?.name).toBe(manifest?.defaultPreset);
    expect(sounds[0]?.description).toMatch(new RegExp(`^bass ${manifest?.defaultPreset}: `));
    expect(presetViews(undefined, FAKE_DESCRIPTIONS)).toEqual([]);
  });
});
describe("the gain fader", () => {
  it("puts gain 1 at 75 % and reads 0.0 dB; no gain written is unity", () => {
    expect(gainSlider({ index: 0, name: "gain", value: 1, signal: null, explicit: true }, FAKE_LABELS)).toMatchObject({ display: "0.0 dB", fraction: 0.75 });
    expect(gainSlider(undefined, FAKE_LABELS)).toMatchObject({ display: "0.0 dB", fraction: 0.75 });
  });
});
describe("tone", () => {
  it("marks a written parameter tone moves as overriding it", () => {
    const rows = soundParameters(trackIn("ride: hat x.x. | open 0.7\n", "ride"), fixture.registry.get("hat"), FAKE_LABELS);
    expect(rows.find((row) => row.name === "open")?.toneRole).toBe("overrides");
    expect(soundParameters(trackIn("ride: hat x.x.\n", "ride"), fixture.registry.get("hat"), FAKE_LABELS).find((row) => row.name === "open")?.toneRole).toBe("follows");
  });
  it("sits in the middle without a manifest or a written tone parameter", () => {
    const track = trackIn("bass: bass c2 . . c2\n", "bass");
    expect(toneOf(track, undefined)).toBe(0.5);
    expect(toneOf(track, fixture.registry.get("bass"))).toBe(0.5);
  });
});
describe("effectViews", () => {
  it("lists the insert effects in chain order with their sliders", () => {
    const views = effectViews(trackIn("bass: bass c2 . . c2 | lowpass 900 | eq-high 2\n", "bass"), FAKE_LABELS);
    expect(views.map((view) => view.effect)).toEqual(["lowpass", "eq"]);
    expect(views[0]?.parameters[0]?.display).toBe("900 Hz");
  });
});
