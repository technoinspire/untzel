// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// An integration test of the composition: the presenters of @untzel/presentation over the
// app's registry, which a package may not import.

import type { ParameterView, TrackView } from "@untzel/session";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { gainSlider, mixParameters, soundParameters } from "@untzel/presentation";
import { PRESENTATION_COPY } from "../adapters/presentation-copy";
const { labels } = PRESENTATION_COPY;

function gain(value: number | null, signal: ParameterView["signal"] = null): ParameterView {
  return { index: 0, name: "gain", value, signal, explicit: true };
}

describe("the gain fader in the Mix group", () => {
  it("puts gain 1 at 75 % and reads 0.0 dB", () => {
    expect(gainSlider(gain(1), labels)).toMatchObject({ display: "0.0 dB", fraction: 0.75, signal: null });
  });

  it("reads Off at the bottom and −6.0 dB for gain 0.501", () => {
    expect(gainSlider(gain(0), labels)).toMatchObject({ display: "Off", fraction: 0 });
    expect(gainSlider(gain(0.501), labels)).toMatchObject({ display: "\u22126.0 dB" });
    expect(gainSlider(gain(0.501), labels).fraction).toBeCloseTo(0.6, 2);
  });

  it("places a gain under the floor just above Off with its real level", () => {
    const slider = gainSlider(gain(0.0005), labels);
    expect(slider.display).toBe("\u221266.0 dB");
    expect(slider.fraction).toBeGreaterThan(0);
    expect(slider.fraction).toBeLessThan(0.01);
  });

  it("shows a signal's band by the fader law, with both ends in dB", () => {
    const slider = gainSlider(gain(null, { shape: "saw", periodBars: 8, low: 0.15, high: 0.5, from: 0, to: 1, curve: "linear" }), labels);
    expect(slider.signal?.from).toBeCloseTo(0.338, 3);
    expect(slider.signal?.to).toBeCloseTo(0.6, 2);
    expect(slider.display).toBe("saw 8 bars · \u221216.5 to \u22126.0 dB");
  });

  it("is the gain row of mixParameters", () => {
    const track = { parameters: [gain(0.501)] } as unknown as TrackView;
    expect(mixParameters(track, labels)[0]).toMatchObject({ name: "gain", display: "\u22126.0 dB" });
  });
});

describe("tone roles of the Sound sliders", () => {
  it("marks the written parameter tone would move as overriding it, and the others as following", () => {
    const hat = buildRegistry().registry.get("hat");
    const open: ParameterView = { index: 32, name: "open", value: 0.7, signal: null, explicit: true };
    const track = { parameters: [open] } as unknown as TrackView;
    const rows = soundParameters(track, hat, labels);
    expect(rows.find((row) => row.name === "open")?.toneRole).toBe("overrides");
    expect(rows.find((row) => row.name === "decay")?.toneRole).toBeNull();
    const plain = soundParameters({ parameters: [] } as unknown as TrackView, hat, labels);
    expect(plain.find((row) => row.name === "open")?.toneRole).toBe("follows");
  });
});
