// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The sliders of the track detail and the tile's tone: where a value sits on its
// curve, how it reads, and the effect chain with its sliders. Pure, tested in Node.
import { EFFECT_PARAMETERS, curvePosition, gainLabel, gainToPosition, interp, type Curve, type InstrumentManifest } from "@untzel/core";
import type { ParameterView, SignalView, TrackView } from "@untzel/session";
import type { InstrumentDescriptions, ParameterLabels } from "./presentation-copy";
import type { EffectView, ParameterView as ControlParameterView, SoundView } from "./view-model";

/** Mix sliders of the detail, by text modifier name; delay is a division, not a slider. */
const MIX_PARAMETERS = [
  { name: "gain", index: 0, min: 0, max: 2 },
  { name: "pan", index: 1, min: -1, max: 1 },
  { name: "reverb", index: 2, min: 0, max: 1 },
  { name: "duck", index: 6, min: 0, max: 1 },
] as const;


export function formatNumber(value: number): string {
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** "8 bars", "0.50 bars": a whole period reads as it is written ("sine 8 bars"). */
function periodText(bars: number): string {
  return Number.isInteger(bars) ? String(bars) : formatNumber(bars);
}

function withUnit(value: number, unit: string): string {
  return unit === "" ? formatNumber(value) : `${formatNumber(value)} ${unit}`;
}

function panLabel(value: number, labels: ParameterLabels): string {
  const percent = Math.round(Math.abs(value) * 100);
  if (percent === 0) return labels.panCenter;
  return value < 0 ? labels.panLeft(percent) : labels.panRight(percent);
}

/** The parameter values a signal sweeps: its written range, through the curve. */
function signalRange(signal: SignalView): { readonly low: number; readonly high: number } {
  return {
    low: interp(signal.curve, signal.from, signal.to, signal.low),
    high: interp(signal.curve, signal.from, signal.to, signal.high),
  };
}

function sliderOf(
  name: string,
  parameter: ParameterView | undefined,
  curve: Curve,
  min: number,
  max: number,
  label: (value: number) => string,
  labels: ParameterLabels,
): ControlParameterView {
  const signal = parameter?.signal ?? null;
  if (signal !== null) {
    const { low, high } = signalRange(signal);
    const from = curvePosition(curve, min, max, low);
    const to = curvePosition(curve, min, max, high);
    return {
      name,
      display: labels.signalOver(signal.shape, periodText(signal.periodBars), `${label(low)}–${label(high)}`),
      fraction: (from + to) / 2,
      signal: { from: Math.min(from, to), to: Math.max(from, to) },
      toneRole: null,
    };
  }
  const value = parameter?.value ?? min;
  return { name, display: label(value), fraction: curvePosition(curve, min, max, value), signal: null, toneRole: null };
}

/**
 * The gain fader: where the written gain sits by the fader law, and
 * its level in dB ("−6.0 dB", "Off"); a signal shows its band and both ends in dB.
 */
export function gainSlider(parameter: ParameterView | undefined, labels: ParameterLabels): ControlParameterView {
  const signal = parameter?.signal ?? null;
  if (signal !== null) {
    const { low, high } = signalRange(signal);
    const from = gainToPosition(Math.min(low, high));
    const to = gainToPosition(Math.max(low, high));
    const lowText = gainLabel(Math.min(low, high)).replace(/ dB$/, "");
    return {
      name: "gain",
      display: labels.signalOver(signal.shape, periodText(signal.periodBars), labels.gainRange(lowText, gainLabel(Math.max(low, high)))),
      fraction: (from + to) / 2,
      signal: { from, to },
      toneRole: null,
    };
  }
  const value = parameter?.value ?? 1;
  return { name: "gain", display: gainLabel(value), fraction: gainToPosition(value), signal: null, toneRole: null };
}

/** A parameter the tone mapping moves: written it overrides tone, else it follows it. */
function toneRoleOf(name: string, written: ParameterView | undefined, manifest: InstrumentManifest): ControlParameterView["toneRole"] {
  if (!manifest.tone.some((mapping) => mapping.parameter === name)) return null;
  return written?.explicit === true ? "overrides" : "follows";
}

export function soundParameters(track: TrackView, manifest: InstrumentManifest | undefined, labels: ParameterLabels): ControlParameterView[] {
  if (manifest === undefined) return [];
  return manifest.parameters.map((definition) => {
    const written = track.parameters.find((parameter) => parameter.name === definition.name);
    const slider = sliderOf(definition.name, written, definition.curve, definition.min, definition.max, (value) => withUnit(value, definition.unit), labels);
    return { ...slider, toneRole: toneRoleOf(definition.name, written, manifest) };
  });
}

export function mixParameters(track: TrackView, labels: ParameterLabels): ControlParameterView[] {
  return MIX_PARAMETERS.map((definition) =>
    definition.name === "gain" ? gainSlider(track.parameters.find((parameter) => parameter.index === definition.index), labels) : sliderOf(
      definition.name,
      track.parameters.find((parameter) => parameter.index === definition.index),
      "linear",
      definition.min,
      definition.max,
      definition.name === "pan" ? (value) => panLabel(value, labels) : formatNumber,
      labels,
    ),
  );
}

/** Where the first tone mapping of the manifest puts the track, 0..1. */
export function toneOf(track: TrackView, manifest: InstrumentManifest | undefined): number {
  const mapping = manifest?.tone[0];
  if (manifest === undefined || mapping === undefined) return 0.5;
  const definition = manifest.parameters.find((parameter) => parameter.name === mapping.parameter);
  const parameter = track.parameters.find((candidate) => candidate.name === mapping.parameter);
  if (definition === undefined || parameter === undefined) return 0.5;
  if (parameter.signal !== null) {
    const { low, high } = signalRange(parameter.signal);
    const middle = interp(definition.curve, low, high, 0.5);
    return curvePosition(definition.curve, mapping.from, mapping.to, middle);
  }
  return curvePosition(definition.curve, mapping.from, mapping.to, parameter.value ?? definition.default);
}

/** Every sound of the instrument, the default first (the library lists them the same way). */
export function presetViews(manifest: InstrumentManifest | undefined, descriptions: InstrumentDescriptions): readonly SoundView[] {
  if (manifest === undefined) return [];
  return [...manifest.presets]
    .sort((a, b) => Number(b.name === manifest.defaultPreset) - Number(a.name === manifest.defaultPreset))
    .map((preset) => ({ name: preset.name, description: descriptions.soundDescription(manifest.name, preset.name, preset.description) }));
}

/** The insert effects in chain order; `eq` shows its three bands and the mid frequency. */
export function effectViews(track: TrackView, labels: ParameterLabels): readonly EffectView[] {
  return track.effects.map((effect) => ({
    effect,
    parameters: EFFECT_PARAMETERS.filter((definition) => definition.effect === effect).map((definition) =>
      sliderOf(
        definition.name,
        track.parameters.find((parameter) => parameter.name === definition.name),
        definition.curve,
        definition.min,
        definition.max,
        (value) => withUnit(value, definition.unit),
        labels,
      ),
    ),
  }));
}
