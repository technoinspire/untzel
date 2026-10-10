// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { printNumber } from "@untzel/language";
import type { DemoAction } from "../actions";
import { barCells, barGestures, gridGap, type StepCell } from "./pattern-steps";
import type { ScriptWriter } from "./script-writer";
import type { TemplateTrack, WrittenModifier } from "./template";
import { serialize } from "./program-equality";

// One track layer: add the instrument, draw the pattern on the grid (or type it when the
// grid cannot), then turn the knobs. Mute comes last, so the track is heard first.

const NUMBER = /^-?\d+(\.\d+)?$/;

function currentCells(writer: ScriptWriter, track: string): StepCell[][] {
  return writer.track(track).pattern.bars.map(barCells);
}

function editBar(writer: ScriptWriter, track: string, bar: number, target: readonly StepCell[]): void {
  const current = currentCells(writer, track)[bar] ?? [];
  for (const action of barGestures(track, bar, current, target)) writer.do(action);
}

/** Bar 0 first, then the copies of it, then the bars that differ. */
function drawPattern(writer: ScriptWriter, track: string, target: readonly (readonly StepCell[])[], hold: boolean): void {
  const count = target[0]?.length ?? 0;
  if (currentCells(writer, track).length > 1) writer.do({ kind: "setTrackBars", track, bars: 1 });
  if ((currentCells(writer, track)[0]?.length ?? 0) !== count) writer.do({ kind: "setStepCount", track, count, hold });
  editBar(writer, track, 0, target[0] ?? []);
  if (target.length > 1) writer.do({ kind: "setTrackBars", track, bars: target.length });
  target.slice(1).forEach((cells, index) => editBar(writer, track, index + 1, cells));
  if (serialize(currentCells(writer, track)) !== serialize(target)) {
    throw new Error(`the grid did not draw the pattern of ${track}`);
  }
}

/** A pattern the grid cannot draw is typed whole, in bursts: a few words at a time. */
function buildPattern(writer: ScriptWriter, template: TemplateTrack, track: string): void {
  const target = template.track.pattern.bars.map(barCells);
  const pitched = template.manifest.kind !== "drum";
  const gap = gridGap(target, pitched, currentCells(writer, track)[0]?.length ?? 0);
  if (gap === null) {
    drawPattern(writer, track, target, pitched);
    return;
  }
  writer.do({ kind: "typeCode", placement: { kind: "trackPattern", track }, text: template.patternText, reason: gap, pace: "bursts" });
}

function modifierAction(track: string, modifier: WrittenModifier): DemoAction {
  const { name, value } = modifier;
  const typed = (reason: Extract<DemoAction, { kind: "typeCode" }>["reason"]): DemoAction => ({
    kind: "typeCode",
    placement: { kind: "trackEnd", track },
    text: ` | ${value === null ? name : `${name} ${value}`}`,
    reason,
    pace: "keys",
  });
  if (value === null) return typed("flag");
  if (!NUMBER.test(value)) return typed(value.includes("(") ? "signal-value" : "named-value");
  const number = Number(value);
  if (Number(printNumber(number)) !== number) return typed("precision");
  return { kind: "setParameter", track, parameter: name, value: number };
}

/** The template mutes this track (a plain `| mute`). */
export function isMutedInTemplate(template: TemplateTrack): boolean {
  return template.modifiers.some((modifier) => modifier.name === "mute" && modifier.value === null);
}
/**
 * Adds one track of the template under its own name and builds it. Its mute, if the
 * template has one, comes last, after the track was heard, unless `defersMute`: then the
 * caller mutes it later (after the Drop, which takes every mute away).
 */
export function buildTrackLayer(writer: ScriptWriter, template: TemplateTrack, defersMute = false): void {
  const target = template.track.name;
  const added = writer.addTrack(template.manifest, template.track.preset);
  if (added !== target) writer.do({ kind: "renameTrack", track: added, newName: target });
  buildPattern(writer, template, target);
  const isMuted = isMutedInTemplate(template);
  template.modifiers
    .filter((modifier) => !(modifier.name === "mute" && modifier.value === null))
    .forEach((modifier) => writer.do(modifierAction(target, modifier)));
  if (isMuted && !defersMute) writer.do({ kind: "setMute", track: target, muted: true });
}
